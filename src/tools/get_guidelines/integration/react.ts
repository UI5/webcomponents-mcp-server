const getReactGuide = () => `# UI5 Web Components for React

## Installation
\`\`\`bash
npm install @ui5/webcomponents @ui5/webcomponents-react @ui5/webcomponents-fiori
\`\`\`

## Setup
Wrap your app with ThemeProvider:
\`\`\`jsx
import { ThemeProvider } from '@ui5/webcomponents-react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById("root"));
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
\`\`\`

## Usage
\`\`\`jsx
import { Button, Input } from '@ui5/webcomponents-react';

function App() {
  return (
    <>
      <Input placeholder="Enter text" />
      <Button onClick={() => alert('Clicked!')}>
        Click me
      </Button>
    </>
  );
}
\`\`\`

## Custom Components in Slots
When using custom React components in slots, pass the slot prop to the outer element:

\`\`\`jsx
import { Bar, Button } from '@ui5/webcomponents-react';

const BarStart = (props) => {
  return <div slot={props.slot}>Start</div>;
};

const BarEnd = (props) => {
  return <Button slot={props.slot}>Close</Button>;
};

export const BarComponent = () => {
  return (
    <Bar startContent={<BarStart slot="start" />} endContent={<BarEnd slot="end" />}>
      <div>Content</div>
    </Bar>
  );
};
\`\`\`

## Theming
\`\`\`jsx
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme';
import '@ui5/webcomponents/dist/Assets.js';

// Available themes: sap_horizon (default), sap_horizon_dark, sap_fiori_3, sap_fiori_3_dark
setTheme('sap_horizon_dark');
\`\`\`

## Compact Mode
Add CSS class to enable compact sizing:
\`\`\`html
<body class="ui5-content-density-compact">
\`\`\`

## TypeScript
\`\`\`tsx
import type { ButtonPropTypes } from '@ui5/webcomponents-react';

const handleClick: ButtonPropTypes['onClick'] = (e) => {
  // typed event handler
};
\`\`\`
`;

export { getReactGuide };