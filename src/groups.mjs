// Google Cloud group styles. Google publishes no group-style deck, so these follow the conventions of Google Cloud architecture
// diagrams (Architecture Center): a thin coloured boundary per scope, a corner icon for project / VPC where Google provides one
// and the label to its right. The palette is Google's (blue #4285F4, green #34A853, red #EA4335, yellow #FBBC04, greys).
export const GROUP_KINDS = {
  "gcp-cloud":    { label: "Google Cloud", color: "#3C4043", icon: null, dash: "", fillLight: "none", fillDark: "none" },
  "organization": { label: "Organization", color: "#5F6368", icon: "Organization", dash: "", fillLight: "none", fillDark: "none" },
  "folder":       { label: "Folder", color: "#9AA0A6", icon: null, dash: "6 4", fillLight: "none", fillDark: "none" },
  "project":      { label: "Project", color: "#4285F4", icon: "Project", dash: "", fillLight: "none", fillDark: "none" },
  "region":       { label: "Region", color: "#4285F4", icon: null, dash: "2 3", fillLight: "none", fillDark: "none" },
  "zone":         { label: "Zone", color: "#669DF6", icon: null, dash: "6 4", fillLight: "none", fillDark: "none" },
  "vpc":          { label: "VPC network", color: "#34A853", icon: "VPC", dash: "", fillLight: "none", fillDark: "none" },
  "subnet":       { label: "Subnet", color: "#1A73E8", icon: "Subnet", dash: "", fillLight: "#EEF4FE", fillDark: "#1A73E818" },
  "perimeter":    { label: "VPC Service Controls perimeter", color: "#EA4335", icon: "Perimeter", dash: "6 4", fillLight: "none", fillDark: "none" },
  "firewall":     { label: "Firewall rules", color: "#D93025", icon: "Firewall", dash: "", fillLight: "none", fillDark: "none" },
  "on-premises":  { label: "On-premises", color: "#7A7574", icon: null, dash: "", fillLight: "none", fillDark: "none" },
  "generic":      { label: "", color: "#7A7574", icon: null, dash: "", fillLight: "none", fillDark: "none" },
  "generic-dashed": { label: "", color: "#7A7574", icon: null, dash: "6 4", fillLight: "none", fillDark: "none" },
  // stack: invisible container used only for layout (no border, no padding); cannot be an edge endpoint
  "stack":        { label: "", color: "none", icon: null, dash: "", fillLight: "none", fillDark: "none" },
  // custom group: pass `icon` (a service id) -> uses a blue border and the 32px service icon
  "custom":       { label: "", color: "#7A7574", icon: null, dash: "", fillLight: "none", fillDark: "none" },
};

export const PILLARS = ["operational-excellence", "security", "reliability", "cost-optimization", "performance-optimization"];
