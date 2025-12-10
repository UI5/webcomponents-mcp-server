const getAngularGuide = () => `# UI5 Web Components for Angular

## Installation
\`\`\`bash
npm install @ui5/webcomponents-ngx
\`\`\`

## Module Setup
\`\`\`typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

// Import UI5 wrapper components
import { LabelComponent } from '@ui5/webcomponents-ngx/main/label';
import { ButtonComponent } from '@ui5/webcomponents-ngx/main/button';
import { InputComponent } from '@ui5/webcomponents-ngx/main/input';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    LabelComponent,
    InputComponent,
    ButtonComponent
  ],
  // ... other config
})
export class AppModule { }
\`\`\`

## Component Usage with NgModel
\`\`\`typescript
// app.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: \`
    <form #form="ngForm">
      <div>
        <ui5-label for="firstName">First Name:</ui5-label>
        <ui5-input 
          id="firstName"
          [(ngModel)]="model.firstName" 
          name="firstName" 
          [required]="true">
        </ui5-input>
      </div>
      
      <div>
        <ui5-label for="lastName">Last Name:</ui5-label>
        <ui5-input 
          id="lastName"
          [(ngModel)]="model.lastName" 
          name="lastName" 
          [required]="true">
        </ui5-input>
      </div>
      
      <ui5-button [submits]="true">Submit</ui5-button>
      
      <p>Form Value: {{form.value | json}}</p>
      <p>Form Status: {{form.status}}</p>
    </form>
  \`
})
export class AppComponent {
  model = {
    firstName: "",
    lastName: ""
  };
}
\`\`\`

## Key Differences from Native Web Components
- **Wrapper Components**: Use \`@ui5/webcomponents-ngx\` instead of \`@ui5/webcomponents\`
- **NgModel Support**: Two-way data binding with \`[(ngModel)]\`
- **Form Integration**: Works with Angular reactive and template-driven forms
- **No CUSTOM_ELEMENTS_SCHEMA**: Not needed with wrapper components
- **TypeScript Support**: Full type definitions included

## Import Pattern
\`\`\`typescript
// Instead of native web component:
import '@ui5/webcomponents/dist/Button.js';

// Use Angular wrapper:
import { ButtonComponent } from '@ui5/webcomponents-ngx/main/button';
\`\`\`
`;

export { getAngularGuide };