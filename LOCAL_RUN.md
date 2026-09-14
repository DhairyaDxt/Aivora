# Run Aivora locally

This setup replaces Lovable Cloud and Render with local services. Vapi, Twilio, and OpenAI remain external providers because they supply real telephony and AI.

## One-time setup

1. Start Docker Desktop.
2. From `Frontend`, run `npx supabase start`. Copy the printed API URL, anon key, and service-role key.
3. Run `npx supabase db reset` from `Frontend` to create the local schema and RLS policies.
4. Open `http://127.0.0.1:54323`, select SQL Editor, and run `aivora-rag-service/migrations/001_add_rag_columns_and_messages.sql`.
5. Copy `Frontend/.env.local.example` to `Frontend/.env.local`, and replace every `PASTE_...` value. Generate the shared secret with:

   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

6. Copy `aivora-rag-service/.env.local.example` to `aivora-rag-service/.env` and fill it in. `ORCHESTRATION_SHARED_SECRET` must exactly match the frontend value.

## Start the services

Run each command in a separate PowerShell window:

```powershell
cd "C:\New folder (2)\Sem 7\Major\Frontend"
npm install
npm run dev -- --host 0.0.0.0
```

```powershell
cd "C:\New folder (2)\Sem 7\Major\aivora-rag-service"
docker compose up --build
```

The RAG health check is `http://localhost:8001/health`. The frontend is pinned to `http://localhost:4000` via `vite.config.ts` (`strictPort: true`).

## Local workflow

1. Visit the Vite URL, create a new account, and complete onboarding.
2. Create the voice service and save it. **Save/Sync** creates or updates the Vapi assistant using the server-only Vapi key.
3. In the Phone tab, claim the free Vapi number. It is assigned to the current assistant automatically.
4. Add knowledge-base entries. To enable RAG, run this in local Supabase Studio after the RAG service is reachable publicly:

   ```sql
   update app_config
   set orchestration_enabled = true,
       orchestration_url = 'https://YOUR_PUBLIC_RAG_TUNNEL/v1/chat/completions'
   where id = true;
   ```

5. Save/Sync once more, then use **Test call**. Go live only after a number and assistant are present.

## Vapi requires public tunnel URLs

Vapi cloud cannot call `localhost`. For real phone calls and the Vapi Custom LLM integration, expose the local frontend and RAG services with two HTTPS tunnel URLs (for example, Cloudflare Tunnel or ngrok):

- Frontend tunnel -> the local Vite port printed at startup (currently `8081`) for `/api/public/vapi-webhook`.
- RAG tunnel -> local port `8001` for `/v1/chat/completions`.

Open the frontend through its public tunnel before pressing Save/Sync. Set `app_config.orchestration_url` to the RAG tunnel URL, then Save/Sync again.

## Safety

`.env.local` and `aivora-rag-service/.env` are ignored by Git. Never commit or put server credentials in `VITE_*` variables.
