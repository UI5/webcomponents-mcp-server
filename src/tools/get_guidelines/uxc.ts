const getUXCGuide = () => {
  return `
## UXC Composite Components - Extended Guide  
Essential wrapper components for **SAP UXC compliance**. This extended guide provides additional context on **integration, usage patterns, and best practices** for developers and designers building SAP-aligned applications.

---

### UXC Integration Overview  
This sample demonstrates **full adherence** to **SAP UXC Product Consistency standards**. It is a **comprehensive reference implementation**, showcasing how to integrate all **mandatory** and selected **optional** UI elements and interaction patterns. Using these components ensures a **consistent, accessible, and intuitive user experience** across SAP products.

---

### Key Features & Best Practices  

#### 1. **Side Navigation**  
- **Purpose:** Organizes application areas into a **clear hierarchy**.  
- **Usage Tips:**  
  - Place primary navigation items at the **top level**.  
  - Use \`ui5-side-navigation-item\` for main sections and \`ui5-side-navigation-sub-item\` for subsections.  
  - Keep labels **short and descriptive** for better accessibility.  

#### 2. **Shell Bar**  
- **Purpose:** Central toolbar for **navigation, branding, and global actions**.  
- **Mandatory Elements:**  
  - **Side Navigation access**: Use a menu button (e.g., \`ui5-button\` with \`menu2\` icon) for toggling navigation.  
  - **Branding element**: Use \`ui5-shellbar-branding\` to display the application or product name.  
  - **Help/Support**: Include a help action aligned with SAP’s support guidelines.  
  - **User Profile & Menu**: Add a \`ui5-avatar\` with \`ui5-user-menu\` for account management.  
- **Optional Elements:**  
  - **Notifications**: Use \`notifications-count\` and \`ui5-notification-list\` for real-time alerts.  
  - **Settings**: Include a \`ui5-user-settings-dialog\` for personalization features.  

#### 3. **Shell Search**  
- **Purpose:** Provides search aligned with **SAP usability guidelines**.  
- **Usage Tips:**  
  - Place \`<ui5-shellbar-search>\` within the Shell Bar for global access.  
  - Support suggestions or autocomplete for faster discovery.  

#### 4. **User Settings**  
- **Purpose:** Allows **personalization** for **themes**, **language preferences**, or **custom workflows**.  
- **Usage Tips:**  
  - Use \`<ui5-user-settings-item>\` for each configurable category.  
  - Organize settings logically, e.g., **Appearance**, **Notifications**, **Accessibility**.  

#### 5. **Notification Experience**  
- **Purpose:** Deliver **real-time alerts** and updates.  
- **Usage Tips:**  
  - Use \`<ui5-li-notification>\` for each notification item.  
  - Include badges on the Shell Bar for **unread counts**.  
  - Ensure dismiss or action options for each notification.  

---

### Full Example Code  

\`\`\`html
<!-- Full application layout -->
<ui5-navigation-layout>
  <!-- Shell Bar -->
  <ui5-shellbar slot="header" notifications-count="10" show-notifications>
    <ui5-shellbar-branding slot="branding">App Name</ui5-shellbar-branding>
    <ui5-button icon="menu2" slot="startButton" tooltip="Toggle Navigation"></ui5-button>
    <ui5-shellbar-search slot="searchField"></ui5-shellbar-search>
    <ui5-button icon="question-mark" slot="endButton" tooltip="Help"></ui5-button>
    <ui5-avatar slot="profile"></ui5-avatar>
  </ui5-shellbar>
  
  <!-- Side Navigation -->
  <ui5-side-navigation slot="sideContent">
    <ui5-side-navigation-item text="Home" icon="home"></ui5-side-navigation-item>
    <ui5-side-navigation-item text="Reports" icon="bar-chart">
      <ui5-side-navigation-sub-item text="Sales"></ui5-side-navigation-sub-item>
      <ui5-side-navigation-sub-item text="Inventory"></ui5-side-navigation-sub-item>
    </ui5-side-navigation-item>
  </ui5-side-navigation>
</ui5-navigation-layout>

<!-- User Menu -->
<ui5-user-menu show-manage-account>
  <ui5-user-menu-account slot="accounts" title-text="User Name"></ui5-user-menu-account>
</ui5-user-menu>

<!-- User Settings Dialog -->
<ui5-user-settings-dialog>
  <ui5-user-settings-item text="Appearance" icon="palette">
    <ui5-user-settings-view text="Themes"></ui5-user-settings-view>
  </ui5-user-settings-item>
  <ui5-user-settings-item text="Language" icon="globe">
    <ui5-user-settings-view text="Select Language"></ui5-user-settings-view>
  </ui5-user-settings-item>
</ui5-user-settings-dialog>

<!-- Notifications -->
<ui5-notification-list>
  <ui5-li-notification title-text="New Report Available"></ui5-li-notification>
  <ui5-li-notification title-text="System Update Scheduled"></ui5-li-notification>
</ui5-notification-list>
\`\`\`

---

### Integration Notes  
- **Accessibility:** Ensure ARIA attributes and keyboard navigation are correctly applied.  
- **Responsiveness:** Test layouts on various screen sizes. Side Navigation can collapse into icons on smaller viewports.  
- **Consistency:** Follow SAP’s UXC guidelines for spacing, icons, and text labels.  
- **Extensibility:** Add optional components (e.g., **feedback dialogs**, **task center**) only if relevant.  

This guide helps **developers and designers** build **SAP-compliant applications** with **consistent usability** and **brand alignment** across the SAP ecosystem.
  `;
};

export { getUXCGuide };