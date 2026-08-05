// Deprecation and experimental flags follow the Custom Elements Manifest (CEM) shape.
// - `deprecated`: either a string reason (preferred) or `true` for a generic marker.
// - `_ui5experimental`: UI5-specific flag; string note or `true` when marked
//   experimental in JSDoc. Read defensively so the server surfaces it as soon as
//   upstream starts publishing it.
type DeprecatedFlag = string | boolean;
type ExperimentalFlag = string | boolean;

export interface CustomElementsManifest {
    modules?: Array<{
        declarations?: Array<{
            description?: string;
            tagName?: string;
            name?: string;
            deprecated?: DeprecatedFlag;
            _ui5experimental?: ExperimentalFlag;
            attributes?: Array<{
                name: string;
                type?: { text: string };
                description?: string;
                default?: string;
                deprecated?: DeprecatedFlag;
                _ui5experimental?: ExperimentalFlag;
            }>;
            slots?: Array<{
                name: string;
                description?: string;
                deprecated?: DeprecatedFlag;
                _ui5experimental?: ExperimentalFlag;
            }>;
            events?: Array<{
                name: string;
                type?: { text: string };
                description?: string;
                deprecated?: DeprecatedFlag;
                _ui5experimental?: ExperimentalFlag;
            }>;
            members?: Array<{
                name: string;
                kind: string;
                type?: { text: string };
                description?: string;
                deprecated?: DeprecatedFlag;
                _ui5experimental?: ExperimentalFlag;
            }>;
        }>;
    }>;
}

export interface ComponentAttribute {
    name: string;
    type?: { text: string };
    description?: string;
    default?: string;
    deprecated?: DeprecatedFlag;
    _ui5experimental?: ExperimentalFlag;
}

export interface ComponentSlot {
    name: string;
    description?: string;
    deprecated?: DeprecatedFlag;
    _ui5experimental?: ExperimentalFlag;
}

export interface ComponentEvent {
    name: string;
    type?: { text: string };
    description?: string;
    deprecated?: DeprecatedFlag;
    _ui5experimental?: ExperimentalFlag;
}

export interface ComponentMember {
    name: string;
    kind: string;
    type?: { text: string };
    description?: string;
    deprecated?: DeprecatedFlag;
    _ui5experimental?: ExperimentalFlag;
}

export interface ComponentData {
    name: string;
    tagName: string;
    description: string;
    deprecated?: DeprecatedFlag;
    _ui5experimental?: ExperimentalFlag;
    attributes?: ComponentAttribute[];
    slots?: ComponentSlot[];
    events?: ComponentEvent[];
    members?: ComponentMember[];
}

export type Framework = "react" | "angular" | "native";

export interface NpmPackageData {
    name: string;
    version: string;
    customElements?: string;
    dist?: {
        tarball: string;
    };
}
