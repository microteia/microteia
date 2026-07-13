import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "../firebase/initFirebase";
import { FieldValue } from "firebase-admin/firestore";
import type { WorkflowStep } from "../../domain/entities/Workflow";

interface CopyPublicWorkflowRequest {
  originalWorkflowId: string;
  targetTenantId: string;
}

interface CopyPublicWorkflowResponse {
  workflowId: string;
  copiedWorkflows: number;
  copiedScripts: number;
  copiedSubWorkflows: number;
}

export const copyPublicWorkflow = onCall<
  CopyPublicWorkflowRequest,
  Promise<CopyPublicWorkflowResponse>
>({ region: "southamerica-east1", cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { originalWorkflowId, targetTenantId } = request.data;

  if (!originalWorkflowId || !targetTenantId) {
    throw new HttpsError(
      "invalid-argument",
      "originalWorkflowId e targetTenantId são obrigatórios",
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

  const workflowIdMap = new Map<string, string>();
  const scriptIdMap = new Map<string, string>();
  const processing = new Set<string>();
  let totalCopiedScripts = 0;

  const copyWorkflowRecursive = async (
    workflowId: string,
    isRoot: boolean,
  ): Promise<void> => {
    if (workflowIdMap.has(workflowId) || processing.has(workflowId)) {
      return;
    }

    processing.add(workflowId);

    const publicWorkflowSnap = await db
      .collection("public_workflows")
      .doc(workflowId)
      .get();
    if (!publicWorkflowSnap.exists) {
      processing.delete(workflowId);
      throw new HttpsError(
        "not-found",
        `Workflow público ${workflowId} não encontrado`,
      );
    }

    const publicWorkflow = publicWorkflowSnap.data();
    if (!publicWorkflow) {
      processing.delete(workflowId);
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
              const newScriptRef = await db
                .collection("tenants")
                .doc(targetTenantId)
                .collection("scripts")
                .add({
                  name: scriptData.name,
                  description: scriptData.description,
                  sourceTs: scriptData.sourceTs,
                  compiledJs: scriptData.compiledJs,
                  inputParams: scriptData.inputParams,
                  outputParams: scriptData.outputParams,
                  createdBy: "workflow-engine",
                  createdAt: FieldValue.serverTimestamp(),
                });
              scriptIdMap.set(scriptId, newScriptRef.id);
              totalCopiedScripts++;
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
        const subWorkflowId = targetWorkflowIdMapping.value as string;
        if (subWorkflowId && !workflowIdMap.has(subWorkflowId)) {
          await copyWorkflowRecursive(subWorkflowId, false);
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

    const newWorkflowRef = await db
      .collection("tenants")
      .doc(targetTenantId)
      .collection("workflow_definitions")
      .add({
        name: isRoot ? `${publicWorkflow.name} (cópia)` : publicWorkflow.name,
        description: publicWorkflow.description,
        eventName: publicWorkflow.eventName,
        screenKey: publicWorkflow.screenKey,
        lookupCollection: publicWorkflow.lookupCollection,
        parameters: publicWorkflow.parameters,
        isPublic: false,
        enabled: false,
        version: 1,
        condition: publicWorkflow.condition ?? { kind: "AlwaysTrue" },
        steps: updatedSteps,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    workflowIdMap.set(workflowId, newWorkflowRef.id);
    processing.delete(workflowId);
  };

  await copyWorkflowRecursive(originalWorkflowId, true);

  return {
    workflowId: workflowIdMap.get(originalWorkflowId)!,
    copiedWorkflows: workflowIdMap.size,
    copiedScripts: totalCopiedScripts,
    copiedSubWorkflows: workflowIdMap.size - 1,
  };
});
