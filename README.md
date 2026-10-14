# Manas — Personal AI Assistant

Manas is a responsive Node.js assistant for chat, message analysis, code review, and personal tasks. It supports local Ollama for Windows development and hosted OpenAI-compatible APIs for a public chat deployment.

## Local Windows use

Requires Node.js 20 or later. Ollama can run locally on Windows 10/11; `llama3.2:1b` is a small model for an 8 GB PC.

```powershell
ollama pull llama3.2:1b
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm start
```

Open http://127.0.0.1:3000. The local `.env` selects Ollama's native `/api/chat` format. The project uses no npm runtime dependencies.

## Provider choice for hosted chat

The server already implements OpenAI Chat Completions (`/chat/completions`), bearer authorization, and response parsing. **Groq is the simplest fit**: its [OpenAI compatibility docs](https://console.groq.com/docs/openai) specify the base URL `https://api.groq.com/openai/v1`. As checked in October 2026, Groq lists `openai/gpt-oss-20b` as the recommended successor for the retired Llama 3.1 8B Instant model. Groq's [free plan is quota-limited](https://console.groq.com/docs/rate-limits) (per-model RPM/RPD/token caps); quotas vary and can change, so check the account/model limits. Free access is not unlimited or a reliability guarantee.

Google AI Studio's Gemini API also supports [OpenAI-compatible Chat Completions](https://ai.google.dev/gemini-api/docs/openai) at `https://generativelanguage.googleapis.com/v1beta/openai/`. Its [free tier](https://ai.google.dev/gemini-api/docs/pricing) has limited model access and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits); Google says content used on the free tier may be used to improve products. Do not send sensitive personal information through that tier. Either hosted provider receives the submitted prompts. Keep its key only in Render's server-side Environment settings.

## Render free deployment

`render.yaml` configures a Node Web Service, `npm start`, Render's `PORT`, `0.0.0.0` binding, a health check, hosted OpenAI-compatible AI, and **chat-only mode**. The deployment intentionally disables shared server-side chats, tasks, analyses, code review, and email; this prevents visitors from seeing one another's personal data. Public chat history is stored in that visitor's browser only. It is not synced between devices and is not an account or secure private vault.

1. Create a **private GitHub repository**. In this project folder, initialize Git if needed, commit the project, and push it. `.env` and `data/` are ignored; never force-add `.env` or put a provider key in a commit.
2. Create an account at Groq and create an API key. Review the current free-plan terms and model-specific quota before using it. Do not paste the key into this repository.
3. In Render, choose **New → Blueprint**, connect the private GitHub repository, and deploy the `render.yaml` blueprint. If Render asks for `AI_API_KEY`, enter the Groq key there. The key is injected into the Node server environment, never into browser JavaScript.
4. Wait for the deploy to finish. Visit the generated `https://<service>.onrender.com` URL and verify the AI status and an actual chat response. Do not announce the site until this live check succeeds.

The blueprint sets `AI_API_FORMAT=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-20b`, and a 384-token output cap. Change these in Render's Environment dashboard if needed; never store credentials in `render.yaml`. No Ollama installation or local Windows AI is used by the hosted service. `PORT` is supplied by Render and the production server binds to `0.0.0.0`.

### Free-tier and privacy limitations

- Render Free Web Services sleep after 15 minutes without traffic; waking may take about a minute. Their filesystem is ephemeral, and free instances can restart. Public chat is therefore kept in browser `localStorage`, not `data/assistant.json` ([Render free limits](https://render.com/docs/free)).
- Render's free Postgres is temporary (currently expires after 30 days), so it is not a durable store for private accounts. For durable multi-user accounts and cross-device history, add a managed persistent database and implement real user authentication and per-user authorization before enabling those features. This is not included in the public chat-only deployment.
- Email OAuth/Gmail access is not implemented. Reminders are records only; there is no background scheduler or notification delivery. Tasks and message/code analysis remain local/private-mode features and are blocked in public mode.
- Basic server-side chat rate limiting is 12 requests per client IP per 10 minutes, with a 4,000-character input cap and a 90-second provider timeout. The free hosting/provider quotas still apply. These controls reduce casual abuse but are not a substitute for identity-based quotas, bot protection, or abuse monitoring at larger scale.
- Hosted AI providers process prompts under their own terms. Never submit sensitive data unless you have reviewed the provider's current data policy.

## Tests

Run `npm test` locally. It checks health/status/chat behavior; provider integration requires valid server-side settings and an available provider. A local test does not prove the Render deployment works.
