export interface CustomElementsManifest {
    modules?: Array<{
        declarations?: Array<{
            description?: string;
            tagName?: string;
            name?: string;
            attributes?: Array<{
                name: string;
                type?: { text: string };
                description?: string;
                default?: string;
            }>;
            slots?: Array<{
                name: string;
                description?: string;
            }>;
            events?: Array<{
                name: string;
                type?: { text: string };
                description?: string;
            }>;
            members?: Array<{
                name: string;
                kind: string;
                type?: { text: string };
                description?: string;
            }>;
        }>;
    }>;
}

export interface ComponentAttribute {
    name: string;
    type?: { text: string };
    description?: string;
    default?: string;
}

export interface ComponentSlot {
    name: string;
    description?: string;
}

export interface ComponentEvent {
    name: string;
    type?: { text: string };
    description?: string;
}

export interface ComponentMember {
    name: string;
    kind: string;
    type?: { text: string };
    description?: string;
}

export interface ComponentData {
    name: string;
    tagName: string;
    description: string;
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
