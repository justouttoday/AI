/**
 * Rich Text Editor for Blog
 * This script enhances the article editor to preserve formatting
 */

class RichTextEditor {
    constructor(editorId, toolbarId) {
        this.editor = document.getElementById(editorId);
        this.toolbar = document.getElementById(toolbarId);
        
        if (!this.editor || !this.toolbar) {
            console.error('Editor or toolbar element not found');
            return;
        }
        
        this.initToolbar();
        this.initEditor();
    }
    
    initToolbar() {
        // Define toolbar buttons
        const buttons = [
            { command: 'bold', icon: 'B', tooltip: 'Bold' },
            { command: 'italic', icon: 'I', tooltip: 'Italic' },
            { command: 'underline', icon: 'U', tooltip: 'Underline' },
            { command: 'formatBlock', value: 'h2', icon: 'H2', tooltip: 'Heading 2' },
            { command: 'formatBlock', value: 'h3', icon: 'H3', tooltip: 'Heading 3' },
            { command: 'formatBlock', value: 'p', icon: '¶', tooltip: 'Paragraph' },
            { command: 'insertUnorderedList', icon: '• List', tooltip: 'Bullet List' },
            { command: 'insertOrderedList', icon: '1. List', tooltip: 'Numbered List' },
            { command: 'createLink', icon: '🔗', tooltip: 'Insert Link' },
            { command: 'insertImage', icon: '🖼️', tooltip: 'Insert Image' },
            { command: 'justifyLeft', icon: '⇤', tooltip: 'Align Left' },
            { command: 'justifyCenter', icon: '⇔', tooltip: 'Align Center' },
            { command: 'justifyRight', icon: '⇥', tooltip: 'Align Right' },
            { command: 'removeFormat', icon: '✗', tooltip: 'Clear Formatting' }
        ];
        
        // Create toolbar HTML
        const toolbarHTML = buttons.map(button => {
            return `<button type="button" 
                    data-command="${button.command}" 
                    ${button.value ? `data-value="${button.value}"` : ''} 
                    title="${button.tooltip}"
                    class="editor-btn">${button.icon}</button>`;
        }).join('');
        
        this.toolbar.innerHTML = toolbarHTML;
        
        // Add event listeners to buttons
        this.toolbar.querySelectorAll('.editor-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.executeCommand(
                    button.getAttribute('data-command'),
                    button.getAttribute('data-value')
                );
            });
        });
    }
    
    initEditor() {
        // Make editor content editable
        this.editor.contentEditable = true;
        this.editor.style.minHeight = '300px';
        this.editor.style.border = '1px solid #ccc';
        this.editor.style.padding = '10px';
        this.editor.style.borderRadius = '4px';
        
        // Paste as plain text
        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            
            // Get plain text from clipboard
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            
            // Insert text at cursor
            document.execCommand('insertText', false, text);
        });
    }
    
    executeCommand(command, value = null) {
        if (command === 'createLink') {
            const url = prompt('Enter the link URL:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else if (command === 'insertImage') {
            const url = prompt('Enter the image URL:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else {
            document.execCommand(command, false, value);
        }
        
        // Focus back on editor
        this.editor.focus();
    }
    
    getContent() {
        return this.editor.innerHTML;
    }
    
    setContent(html) {
        this.editor.innerHTML = html;
    }
}

// Initialize the editor when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the admin page
    if (document.getElementById('articleEditor') && document.getElementById('editorToolbar')) {
        window.richEditor = new RichTextEditor('articleEditor', 'editorToolbar');
    }
});
