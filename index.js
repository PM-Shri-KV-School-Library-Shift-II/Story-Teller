// Configuration
const CONFIG = {
    MODEL_NAME: "meta-llama/llama-3.3-70b-instruct:free",
    MAX_TOKENS: 16000,
    OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
    API_KEY: import.meta.env?.VITE_OPENROUTER_API_KEY || process.env?.OPENROUTER_API_KEY
};

// DOM Elements
const topicInput = document.getElementById('topic');
const generateBtn = document.getElementById('generateBtn');
const storyOutput = document.getElementById('storyOutput');
const loadingDiv = document.getElementById('loading');

// Initialize application
function initApp() {
    if (!CONFIG.API_KEY || CONFIG.API_KEY === "YOUR_OPENROUTER_API_KEY") {
        showError("⚠️ API Key is not configured. Please check your environment variables.");
        generateBtn.disabled = true;
        return;
    }

    // Add event listeners
    generateBtn.addEventListener('click', generateStory);
    topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateStory();
        }
    });

    // Enable button if input has value
    topicInput.addEventListener('input', () => {
        generateBtn.disabled = !topicInput.value.trim();
    });

    console.log('Story Generator initialized successfully');
}

// Show error message
function showError(message) {
    storyOutput.innerHTML = `
        <div class="alert alert-error">
            ${message}
            <br><br>
            <small>Check your API key configuration in .env file or GitHub Secrets.</small>
        </div>
    `;
}

// Markdown to HTML converter
function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    try {
        const lines = markdown.trim().replace(/\r\n|\r/g, '\n').split('\n');
        let htmlContent = '';
        let inList = false;
        let currentParagraph = '';

        // Helper function for inline processing
        const processInline = (line) => {
            let processedLine = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Handle underline
            processedLine = processedLine.replace(/__([^_]+?)__/g, '<u>$1</u>');
            
            // Handle bold
            processedLine = processedLine.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
            
            return processedLine;
        };

        // Flush paragraph helper
        const flushParagraph = () => {
            if (currentParagraph.trim() !== '') {
                htmlContent += `<p>${processInline(currentParagraph.trim())}</p>\n`;
            }
            currentParagraph = '';
        };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Handle blank lines
            if (line === '') {
                flushParagraph();
                if (inList) {
                    htmlContent += '</ul>\n';
                    inList = false;
                }
                continue;
            }

            // Handle headers
            if (line.startsWith('# ')) {
                flushParagraph();
                if (inList) { htmlContent += '</ul>\n'; inList = false; }
                htmlContent += `<h1>${processInline(line.substring(2))}</h1>\n`;
                continue;
            }

            if (line.startsWith('#### ')) {
                flushParagraph();
                if (inList) { htmlContent += '</ul>\n'; inList = false; }
                htmlContent += `<h4>${processInline(line.substring(5))}</h4>\n`;
                continue;
            }

            // Handle list items
            if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    htmlContent += '<ul>\n';
                    inList = true;
                }
                htmlContent += `<li>${processInline(line.substring(2))}</li>\n`;
                continue;
            }

            // Handle regular paragraph content
            if (inList) {
                htmlContent += '</ul>\n';
                inList = false;
            }

            if (currentParagraph.length > 0) {
                currentParagraph += ' ';
            }
            currentParagraph += line;
        }

        // Final flush
        flushParagraph();
        if (inList) {
            htmlContent += '</ul>\n';
        }

        return `<div class="story-content">${htmlContent}</div>`;
    } catch (error) {
        console.error('Markdown conversion error:', error);
        return `<div class="story-content"><p>${markdown}</p></div>`;
    }
}

// Main story generation function
async function generateStory() {
    const topic = topicInput.value.trim();
    if (!topic) {
        alert("Please enter a story topic!");
        topicInput.focus();
        return;
    }

    // Disable button and show loading
    generateBtn.disabled = true;
    storyOutput.innerHTML = '';
    loadingDiv.classList.add('active');

    // System prompt
    const systemPrompt = `You are an expert children's storyteller for KV students.

**Story Generation Rules:**
1. **Duration:** The story must be approximately 30 minutes in reading length.
2. **Formatting:** You MUST use the following Markdown syntax only:
   * Story Title: Start with **#** followed by the title (e.g., # The Adventure of Rohan).
   * Chapter/Section Headings: Use **####** for subheadings (e.g., #### Chapter One: The Lost Pencil).
   * Emphasis: Use **ONLY double asterisks** (e.g., **important word**) for bold text.
   * Underline: Use **double underscores** (e.g., __special message__) for underlined text.
3. **Content:** The story should subtly reference Indian culture, space exploration, creative worlds, and international themes. Suitable for all ages under 17. Use imaginative names created by combining two names (e.g., Rohina from Rohan and Nina).
4. **Structure:** Include an engaging beginning, middle with challenges, and a satisfying conclusion.
5. **Length:** Minimum 1500 words, maximum 2500 words.`;

    // User prompt
    const userPrompt = `Generate a detailed, full-length story (suitable for 30 minutes of reading) based on the following theme: "${topic}". 
Ensure the story follows all formatting rules and includes imaginative elements that would appeal to school students.`;

    try {
        const response = await fetch(CONFIG.OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin || 'https://github.com',
                'X-Title': 'KV Aliganj Story Generator'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL_NAME,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8,
                max_tokens: CONFIG.MAX_TOKENS,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            
            let errorMessage = `API Error: ${response.status}`;
            if (response.status === 401) {
                errorMessage = "Invalid API Key. Please check your configuration.";
            } else if (response.status === 429) {
                errorMessage = "Rate limit exceeded. Please try again later.";
            } else if (response.status >= 500) {
                errorMessage = "Server error. Please try again later.";
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const storyMarkdown = data.choices[0]?.message?.content || "Sorry, I couldn't generate the story.";
        
        // Convert and display story
        storyOutput.innerHTML = markdownToHtml(storyMarkdown);
        
        // Scroll to story output
        storyOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error("Story generation failed:", error);
        showError(`Error: ${error.message}. Please try again or check your connection.`);
    } finally {
        loadingDiv.classList.remove('active');
        generateBtn.disabled = false;
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for module usage (if needed)
export { generateStory, markdownToHtml, initApp };