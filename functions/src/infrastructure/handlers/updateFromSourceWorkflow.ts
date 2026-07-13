import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "../firebase/initFirebase";
import { FieldValue } from "firebase-admin/firestore";
import type { WorkflowStep } from "../../domain/entities/Workflow";

interface UpdateFromSourceWorkflowRequest {
  workflowId: string;
  targetTenantId: string;
}

interface UpdateFromSourceWorkflowResult {
  updatedWorkflows: number;
  updatedScripts: number;
  updatedSubWorkflows: number;
  newVersion: number;
}

export const updateFromSourceWorkflow = onCall(
  { region: "southamerica-east1", cors: true },
  async (request): Promise<UpdateFromSourceWorkflowResult> => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { workflowId, targetTenantId } = request.data as UpdateFromSourceWorkflowRequest;

  if (!workflowId || !targetTenantId) {
    throw new HttpsError(
      "invalid-argument",
      "workflowId e targetTenantId são obrigatórios",
    );
  }

  const db = getDb();
  const userId = request.auth.uid;

  const memberDoc = await db
    .collection("tenants")
    .doc(targetTenantId)
    .collection("members")
    .doc(userId)
    .get();

  if (!memberDoc.exists) {
    throw new HttpsError(
      "permission-denied",
      "Usuário não é membro do tenant destino",
    );
  }

  const targetWorkflowSnap = await db
    .collection("tenants")
    .doc(targetTenantId)
    .collection("workflow_definitions")
    .doc(workflowId)
    .get();

  if (!targetWorkflowSnap.exists) {
    throw new HttpsError(
      "not-found",
      `Workflow ${workflowId} não encontrado no tenant destino`,
    );
  }

  const targetWorkflow = targetWorkflowSnap.data();
  if (!targetWorkflow) {
    throw new HttpsError("internal", "Dados do workflow inválidos");
  }

  const sourceWorkflowId = targetWorkflow.sourceWorkflowId as string | undefined;
  if (!sourceWorkflowId) {
    throw new HttpsError(
      "invalid-argument",
      "Este workflow não foi copiado de um workflow público (sourceWorkflowId não encontrado)",
    );
  }

  const workflowIdMap = new Map<string, string>();
  const scriptIdMap = new Map<string, string>();
  const processing = new Set<string>();
  let totalUpdatedScripts = 0;
  let newVersion = 1;

  const updateWorkflowRecursive = async (
    originalWorkflowId: string,
    targetWorkflowIdParam: string,
  ): Promise<void> => {
    if (workflowIdMap.has(originalWorkflowId) || processing.has(originalWorkflowId)) {
      return;
    }

    processing.add(originalWorkflowId);

    const publicWorkflowSnap = await db
      .collection("public_workflows")
      .doc(originalWorkflowId)
      .get();
    if (!publicWorkflowSnap.exists) {
      processing.delete(originalWorkflowId);
      throw new HttpsError(
        "not-found",
        `Workflow público ${originalWorkflowId} não encontrado`,
      );
    }

    const publicWorkflow = publicWorkflowSnap.data();
    if (!publicWorkflow) {
      processing.delete(originalWorkflowId);
      throw new HttpsError("internal", "Dados do workflow inválidos");
    }

    const sourceTenantId = publicWorkflow.originalTenantId as string;
    const steps = (publicWorkflow.steps as WorkflowStep[]) ?? [];

    const scriptSteps = steps.filter((s) => s.type === "Script");
    for (const step of scriptSteps) {
      const scriptIdMapping = step.configuration.scriptId;
      if (scriptIdMapping && scriptIdMapping.kind === "Literal") {
        const scriptId = scriptIdMapping.value as string;
        if (scriptId && !scriptIdMap.has(scriptId)) {
          const sourceScriptSnap = await db
            .collection("tenants")
            .doc(sourceTenantId)
            .collection("scripts")
            .doc(scriptId)
            .get();

          if (sourceScriptSnap.exists) {
            const scriptData = sourceScriptSnap.data();
            if (scriptData) {
              await db
                .collection("tenants")
                .doc(targetTenantId)
                .collection("scripts")
                .doc(scriptId)
                .set({
                  name: scriptData.name,
                  description: scriptData.description,
                  sourceTs: scriptData.sourceTs,
                  compiledJs: scriptData.compiledJs,
                  inputParams: scriptData.inputParams,
                  outputParams: scriptData.outputParams,
                  createdBy: "workflow-engine",
                  createdAt: FieldValue.serverTimestamp(),
                });
              scriptIdMap.set(scriptId, scriptId);
              totalUpdatedScripts++;
            }
          }
        }
      }
    }

    const subWorkflowSteps = steps.filter((s) => s.type === "SubWorkflow");
    for (const step of subWorkflowSteps) {
      const targetWorkflowIdMapping = step.configuration.targetWorkflowId;
      if (
        targetWorkflowIdMapping &&
        targetWorkflowIdMapping.kind === "Literal"
      ) {
        const subOriginalWorkflowId = targetWorkflowIdMapping.value as string;
        if (subOriginalWorkflowId && !workflowIdMap.has(subOriginalWorkflowId)) {
          const existingSubWorkflowSnap = await db
            .collection("tenants")
            .doc(targetTenantId)
            .collection("workflow_definitions")
            .where("sourceWorkflowId", "==", subOriginalWorkflowId)
            .limit(1)
            .get();

          if (!existingSubWorkflowSnap.empty) {
            const existingSubWorkflowId = existingSubWorkflowSnap.docs[0].id;
            await updateWorkflowRecursive(subOriginalWorkflowId, existingSubWorkflowId);
          } else {
            const publicSubWorkflowSnap = await db
              .collection("public_workflows")
              .doc(subOriginalWorkflowId)
              .get();

            if (publicSubWorkflowSnap.exists) {
              const publicSubWorkflow = publicSubWorkflowSnap.data();
              if (publicSubWorkflow) {
                const newSubWorkflowRef = await db
                  .collection("tenants")
                  .doc(targetTenantId)
                  .collection("workflow_definitions")
                  .add({
                    name: publicSubWorkflow.name,
                    description: publicSubWorkflow.description,
                    eventName: publicSubWorkflow.eventName,
                    lookupCollection: publicSubWorkflow.lookupCollection,
                    parameters: publicSubWorkflow.parameters,
                    isPublic: false,
                    enabled: false,
                    version: publicSubWorkflow.version ?? 1,
                    sourceWorkflowId: subOriginalWorkflowId,
                    sourceVersion: publicSubWorkflow.version ?? 1,
                    condition: publicSubWorkflow.condition ?? { kind: "AlwaysTrue" },
                    steps: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                  });

                await updateWorkflowRecursive(subOriginalWorkflowId, newSubWorkflowRef.id);
              }
            }
          }
        }
      }
    }

    const updatedSteps = steps.map((step) => {
      let updatedStep = { ...step };

      if (step.type === "Script") {
        const scriptIdMapping = step.configuration.scriptId;
        if (scriptIdMapping && scriptIdMapping.kind === "Literal") {
          const oldScriptId = scriptIdMapping.value as string;
          if (oldScriptId && scriptIdMap.has(oldScriptId)) {
            updatedStep = {
              ...updatedStep,
              configuration: {
                ...updatedStep.configuration,
                scriptId: {
                  ...scriptIdMapping,
                  value: scriptIdMap.get(oldScriptId),
                },
              },
            };
          }
        }
      }

      if (step.type === "SubWorkflow") {
        const targetWorkflowIdMapping = step.configuration.targetWorkflowId;
        if (
          targetWorkflowIdMapping &&
          targetWorkflowIdMapping.kind === "Literal"
        ) {
          const oldWorkflowId = targetWorkflowIdMapping.value as string;
          if (oldWorkflowId && workflowIdMap.has(oldWorkflowId)) {
            updatedStep = {
              ...updatedStep,
              configuration: {
                ...updatedStep.configuration,
                targetWorkflowId: {
                  ...targetWorkflowIdMapping,
                  value: workflowIdMap.get(oldWorkflowId),
                },
              },
            };
          }
        }
      }

      return updatedStep;
    });

    newVersion = publicWorkflow.version ?? 1;

    await db
      .collection("tenants")
      .doc(targetTenantId)
      .collection("workflow_definitions")
      .doc(targetWorkflowIdParam)
      .update({
        name: publicWorkflow.name,
        description: publicWorkflow.description,
        eventName: publicWorkflow.eventName,
        lookupCollection: publicWorkflow.lookupCollection,
        parameters: publicWorkflow.parameters,
        version: newVersion,
        sourceVersion: newVersion,
        condition: publicWorkflow.condition ?? { kind: "AlwaysTrue" },
        steps: updatedSteps,
        updatedAt: FieldValue.serverTimestamp(),
      });

    workflowIdMap.set(originalWorkflowId, targetWorkflowIdParam);
    processing.delete(originalWorkflowId);
  };

  await updateWorkflowRecursive(sourceWorkflowId, workflowId);

  return {
    updatedWorkflows: workflowIdMap.size,
    updatedScripts: totalUpdatedScripts,
    updatedSubWorkflows: workflowIdMap.size - 1,
    newVersion,
  };
});
