# AI

## Suno automatic song ability

This repo now includes `suno-automation.js`, which adds a `SunoAutomation` helper that can:

- detect prompts like `make a song about ...`
- send the prompt to a configured Suno-compatible generation API
- poll for completion
- reply with a generated song link

### Quick usage

```html
<script src="suno-automation.js"></script>
<script>
  const suno = new SunoAutomation();

  // One-time setup (stored in localStorage)
  suno.configure({
    apiBaseUrl: "https://YOUR-SUNO-BACKEND/api/v1",
    apiKey: "YOUR_API_KEY"
  });

  async function handleMessage(userText) {
    const result = await suno.handleUserRequest(userText);
    if (result.handled) {
      console.log(result.reply); // includes song link when done
    }
  }
</script>
```

### Important note

Suno's public official API availability can vary, so this helper is backend-agnostic and expects a compatible endpoint pair:

- `POST {apiBaseUrl}/generate`
- `GET {apiBaseUrl}/generate/record-info?taskId=...`

If your provider uses different routes/fields, adapt `startGeneration()` and `fetchSongUrl()` in `suno-automation.js`.
