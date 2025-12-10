const getNativeGuide = () => `# UI5 Web Components for Native HTML/JavaScript

## Installation
\`\`\`bash
npm install @ui5/webcomponents @ui5/webcomponents-fiori @ui5/webcomponents-icons
\`\`\`

## Basic Usage
\`\`\`javascript
// Import components
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/Panel.js";

// Use in HTML
document.querySelector('#app').innerHTML = \`
  <ui5-panel header-text="User Form">
    <ui5-input placeholder="Enter your name"></ui5-input>
    <ui5-button>Submit</ui5-button>
  </ui5-panel>
\`;
\`\`\`

## Event Handling
\`\`\`javascript
const button = document.querySelector('ui5-button');
button.addEventListener('click', (event) => {
  console.log('Button clicked!');
});

const input = document.querySelector('ui5-input');
input.addEventListener('input', (event) => {
  console.log('Input value:', event.target.value);
});
\`\`\`

## Properties and Attributes
\`\`\`javascript
const button = document.querySelector('ui5-button');

// Set properties
button.disabled = true;
button.design = 'Emphasized';

// Set attributes
button.setAttribute('icon', 'add');
button.setAttribute('tooltip', 'Add item');
\`\`\`

## Bundling Requirements
Use any modern bundler that supports:
- JSON imports
- Dynamic ES6 imports

Examples: Vite, Webpack, Rollup, Parcel

## VS Code Setup
Add to \`.vscode/settings.json\`:
\`\`\`json
{
  "html.customData": [
    "./node_modules/@ui5/webcomponents/dist/vscode.html-custom-data.json"
  ]
}
\`\`\`

## Key Points
- **No CDN**: Import and bundle only needed components
- **ES6 Modules**: Distributed as modern JavaScript modules
- **Framework Agnostic**: Works with any frontend setup
- **Tree Shaking**: Bundle only imported components
`;

export { getNativeGuide };