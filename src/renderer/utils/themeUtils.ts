
/**
 * Maps UI5 Web Components theme to Monaco Editor theme.
 * 
 * Light -> vs
 * Dark -> vs-dark
 * High Contrast -> hc-black
 */
export const mapUi5ThemeToMonaco = (ui5Theme: string): string => {
    switch (ui5Theme) {
        case 'sap_horizon':
        case 'sap_fiori_3':
            return 'vs';
        case 'sap_horizon_dark':
        case 'sap_fiori_3_dark':
            return 'vs-dark';
        case 'sap_horizon_hcb':
        case 'sap_horizon_hcw':
        case 'sap_fiori_3_hcb':
        case 'sap_fiori_3_hcw':
            return 'hc-black';
        default:
            return 'vs-dark';
    }
};
