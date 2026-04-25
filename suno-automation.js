/**
 * Suno automation helper.
 *
 * This module gives the app a command-style interface so a user can type:
 * "make a song about neon city nights"
 * and receive a shareable link when generation completes.
 *
 * Important: Suno does not provide a stable, public official API for all users,
 * so this helper is intentionally endpoint-agnostic. You can point it at any
 * compatible backend route that performs generation and returns a song URL.
 */

(function attachSunoAutomation(global) {
    const COMMAND_PATTERN = /\b(?:make|create|generate)\s+(?:me\s+)?(?:a\s+)?song\b/i;

    class SunoAutomation {
        constructor(config = {}) {
            this.apiBaseUrl = config.apiBaseUrl || localStorage.getItem('suno_api_base_url') || '';
            this.apiKey = config.apiKey || localStorage.getItem('suno_api_key') || '';
            this.pollIntervalMs = Number(config.pollIntervalMs || 4000);
            this.pollTimeoutMs = Number(config.pollTimeoutMs || 180000);
        }

        /**
         * Saves runtime config for future sessions.
         */
        configure({ apiBaseUrl, apiKey }) {
            if (typeof apiBaseUrl === 'string') {
                this.apiBaseUrl = apiBaseUrl.trim();
                localStorage.setItem('suno_api_base_url', this.apiBaseUrl);
            }

            if (typeof apiKey === 'string') {
                this.apiKey = apiKey.trim();
                localStorage.setItem('suno_api_key', this.apiKey);
            }
        }

        /**
         * True if a user message looks like a song generation request.
         */
        canHandle(input) {
            return COMMAND_PATTERN.test((input || '').trim());
        }

        /**
         * Handles a natural-language song request and returns a response object.
         *
         * @returns {Promise<{handled: boolean, reply: string, songUrl?: string}>}
         */
        async handleUserRequest(input) {
            const text = (input || '').trim();

            if (!this.canHandle(text)) {
                return { handled: false, reply: '' };
            }

            if (!this.apiBaseUrl || !this.apiKey) {
                return {
                    handled: true,
                    reply: 'I can make songs once Suno automation is configured. Set apiBaseUrl and apiKey first.'
                };
            }

            const prompt = this.extractPrompt(text);
            if (!prompt) {
                return {
                    handled: true,
                    reply: 'Please tell me what kind of song you want, for example: "make a song about summer rain in lo-fi style".'
                };
            }

            try {
                const taskId = await this.startGeneration(prompt);
                const songUrl = await this.waitForSongUrl(taskId);

                return {
                    handled: true,
                    reply: `Done! Here is your song: ${songUrl}`,
                    songUrl
                };
            } catch (error) {
                console.error('Suno generation failed:', error);
                return {
                    handled: true,
                    reply: 'Sorry, song generation failed. Please try again in a moment.'
                };
            }
        }

        /**
         * Attempts to pull a clean prompt from free-form command text.
         */
        extractPrompt(input) {
            const text = (input || '').trim();

            // remove command prefix (e.g., "make me a song")
            const cleaned = text
                .replace(/\b(?:please\s+)?(?:make|create|generate)\s+(?:me\s+)?(?:a\s+)?song\b/i, '')
                .replace(/^\s*(about|with|in|called)\s+/i, '')
                .trim();

            return cleaned;
        }

        async startGeneration(prompt) {
            const payload = {
                prompt,
                make_instrumental: false,
                wait_audio: false
            };

            const response = await fetch(`${this.apiBaseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Generate request failed with HTTP ${response.status}`);
            }

            const data = await response.json();
            const taskId = data?.taskId || data?.task_id || data?.id;

            if (!taskId) {
                throw new Error('Generation API did not return a task ID');
            }

            return taskId;
        }

        async waitForSongUrl(taskId) {
            const startedAt = Date.now();

            while (Date.now() - startedAt < this.pollTimeoutMs) {
                const songUrl = await this.fetchSongUrl(taskId);
                if (songUrl) {
                    return songUrl;
                }
                await this.sleep(this.pollIntervalMs);
            }

            throw new Error('Timed out waiting for song URL');
        }

        async fetchSongUrl(taskId) {
            const response = await fetch(`${this.apiBaseUrl}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`Status request failed with HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data?.status && ['pending', 'queued', 'processing'].includes(String(data.status).toLowerCase())) {
                return null;
            }

            const directUrl = data?.song_url || data?.audio_url || data?.url;
            if (directUrl) {
                return directUrl;
            }

            if (Array.isArray(data?.songs) && data.songs.length > 0) {
                const first = data.songs[0];
                return first?.song_url || first?.audio_url || first?.share_url || null;
            }

            if (Array.isArray(data?.data) && data.data.length > 0) {
                const first = data.data[0];
                return first?.audio_url || first?.song_url || first?.share_url || null;
            }

            return null;
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    global.SunoAutomation = SunoAutomation;
})(window);
