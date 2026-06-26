export interface UISchema {
  id: string;
  name: string;
  version?: string;
  pages: PageSchema[];
  components: ComponentSchema[];
  sharedComponents?: string[];
  i18n?: Record<string, Record<string, string>>;
}

export interface PageSchema {
  id: string;
  name: string;
  route: string;
  elements: CanvasElement[];
}

export interface ComponentSchema {
  id: string;
  name: string;
  type: string;
  props: Record<string, unknown>;
}

export interface CanvasElement {
  id: string;
  componentId: string;
  name: string;
  gridPosition: {
    column: number;
    row: number;
    colSpan: number;
    rowSpan: number;
  };
  props: Record<string, unknown>;
  classes: string;
  children: string[];
}
