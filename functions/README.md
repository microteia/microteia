# Firebase Functions Environment Variables

## Como configurar:

**Método Recomendado (Firebase Functions v2 + params):**

### 1. Configure as variáveis no arquivo `.env`

Já criamos o arquivo `functions/.env` para você. **Edite-o** e adicione seu Client Secret:

```bash
# Edite functions/.env e cole o Client Secret
GOOGLE_CLIENT_ID=739703754149-56hh73okcsu6abjtdpjgeqnmg4kmth0g.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=COLOQUE_SEU_CLIENT_SECRET_AQUI
GOOGLE_REDIRECT_URI=postmessage
```

### 2. Deploy das funções

```bash
firebase deploy --only functions
```

Durante o deploy, o Firebase vai perguntar os valores das variáveis se não estiverem no `.env`.

**⚠️ IMPORTANTE:** O arquivo `functions/.env` **NÃO** deve ser commitado (já está no `.gitignore`).

## Obter credenciais OAuth:

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Selecione seu projeto
3. Vá em "APIs & Services" → "Credentials"
4. Crie "OAuth 2.0 Client ID" (tipo: Web application)
5. Configure:
   - **Authorized JavaScript origins**: `http://localhost:5173`, `https://seudominio.com`
   - **Authorized redirect URIs**: deixe vazio (usamos `postmessage` para popup)
6. Copie o Client ID e Client Secret

## Segurança:

- ✅ Client ID: pode ficar no `.env` (frontend)
- ❌ Client Secret: **NUNCA** no `.env` — apenas em `functions:config`
