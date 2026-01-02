# Deploying RepoNexus to Fly.io

This guide outlines the steps to deploy the RepoNexus (Next.js) application to Fly.io.

## Prerequisites

1.  **Fly.io Account:** Sign up at [fly.io](https://fly.io/).
2.  **flyctl CLI:** Install the Fly.io command-line tool.
    *   **macOS (brew):** `brew install flyctl`
    *   **Curl:** `curl -L https://fly.io/install.sh | sh`
3.  **SQLite Volume:** The app is configured to use SQLite with a persistent volume (`sqlite_data`) mounted at `/data`. This is defined in `fly.toml`.

## 1. Login to Fly.io

```bash
fly auth login
```

## 2. Initialize the App (First Time Only)

If you haven't already linked the code to a Fly app:

```bash
fly launch --no-deploy
```

*   **App Name:** `reponexus-portfolio` (or your preferred unique name)
*   **Region:** Choose one close to you (e.g., `iad` for Ashburn, VA)
*   **Database:** **Do not** create a Postgres or Redis database. We are using SQLite.
*   **Redis:** Not required.

This will update your `fly.toml` file. Ensure it includes the `[mounts]` section for `sqlite_data`.

## 3. Set Secrets

The application requires several environment variables to run safely. Set them using `fly secrets set`.

```bash
fly secrets set \
  NEXTAUTH_SECRET="your-generated-secure-random-string" \
  NEXTAUTH_URL="https://your-app-name.fly.dev" \
  ENCRYPTION_KEY="your-32-char-encryption-key" \
  OPENROUTER_API_KEY="your-openrouter-api-key" \
  GITHUB_CLIENT_ID="your-github-oauth-client-id" \
  GITHUB_CLIENT_SECRET="your-github-oauth-client-secret"
```

*   **DATABASE_URL:** Not needed as a secret if defined in `fly.toml` as `file:/data/sqlite.db`.
*   **NEXTAUTH_URL:** The full URL of your deployed app.
*   **ENCRYPTION_KEY:** Must be exactly 32 characters.

## 4. Deploy

Deploy the application:

```bash
fly deploy
```

This will:
1.  Build the Docker image.
2.  Provision the `sqlite_data` volume if it doesn't exist (1GB by default).
3.  Push the image and start the machine.

## 5. Post-Deployment Database Setup

Since we are using SQLite on a Volume, we need to ensure the schema is pushed. The `Dockerfile` or `package.json` scripts should handle this, or you can run it manually via SSH if needed.

However, for a fresh volume, you might want to push the schema. You can use `fly ssh console` to access the running machine and run migrations.

```bash
fly ssh console
# Inside the VM:
npx prisma db push
```

## 6. Verification

Visit your app URL: `https://reponexus-portfolio.fly.dev`

## Troubleshooting

*   **Logs:** View real-time logs:
    ```bash
    fly logs
    ```
*   **Status:** Check machine status:
    ```bash
    fly status
    ```
*   **Console:** SSH into the running VM:
    ```bash
    fly ssh console
    ```
