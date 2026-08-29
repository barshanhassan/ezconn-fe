import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useExport } from "@/contexts/ExportContext";
import { useTab } from "@/contexts/TabContext";
import { useTranslation } from "react-i18next";

export default function ExportModal() {
  const { t } = useTranslation();
  const { exportOptions, setExportOptions, isExportModalOpen, setIsExportModalOpen } = useExport();
  const { activeTab, activeSubTab } = useTab();

  const handleCheckboxChange = (tabKey: string, subTabKey: string | null, checkboxKey: string, checked: boolean) => {
    setExportOptions((prev) => {
      const newOptions = { ...prev };
      if (subTabKey) {
        (newOptions[tabKey as keyof typeof newOptions] as any)[subTabKey][checkboxKey] = checked;
      } else {
        (newOptions[tabKey as keyof typeof newOptions] as any)[checkboxKey] = checked;
      }
      return newOptions;
    });
  };

  const handleExport = () => {
    console.log(`Export options for ${activeTab}:`, exportOptions[activeTab as keyof typeof exportOptions]);
    // Reset all checkboxes
    setExportOptions((prev) => {
      const newExportOptions = { ...prev };
      for (const tabKey in newExportOptions) {
        const tabOptions = newExportOptions[tabKey as keyof typeof newExportOptions];
        if (typeof tabOptions === 'object' && tabOptions !== null && !Array.isArray(tabOptions)) {
          for (const subTabKey in tabOptions) {
            const subTabOptions = tabOptions[subTabKey as keyof typeof tabOptions];
            if (typeof subTabOptions === 'object' && subTabOptions !== null && !Array.isArray(subTabOptions)) {
              for (const checkboxKey in (subTabOptions as Record<string, boolean>)) {
                (subTabOptions as Record<string, boolean>)[checkboxKey] = false;
              }
            } else {
              (tabOptions as Record<string, boolean>)[subTabKey] = false;
            }
          }
        }
      }
      return newExportOptions;
    });
    setIsExportModalOpen(false);
  };

  const renderCheckboxes = () => {
    const tabOptions = exportOptions[activeTab as keyof typeof exportOptions];

    if (!tabOptions) return null;

    // For tabs with sub-tabs
    if (typeof tabOptions === 'object' && !Array.isArray(tabOptions)) {
      const firstValue = Object.values(tabOptions)[0];

      if (typeof firstValue === 'object' && !Array.isArray(firstValue)) {
        // Has sub-tabs
        const subTabKey = activeSubTab[activeTab as keyof typeof activeSubTab];
        const subTabOptions = (tabOptions as any)[subTabKey];

        if (subTabOptions) {
          return Object.entries(subTabOptions).map(([key, value]) => (
            <div className="flex items-center space-x-2" key={key}>
              <Checkbox
                id={key}
                checked={value as boolean}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(activeTab, subTabKey, key, checked as boolean)
                }
                data-testid={`checkbox-${key}`}
              />
              <label
                htmlFor={key}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())}
              </label>
            </div>
          ));
        }
      } else {
        // No sub-tabs
        return Object.entries(tabOptions).map(([key, value]) => (
          <div className="flex items-center space-x-2" key={key}>
            <Checkbox
              id={key}
              checked={value as boolean}
              onCheckedChange={(checked) =>
                handleCheckboxChange(activeTab, null, key, checked as boolean)
              }
              data-testid={`checkbox-${key}`}
            />
            <label
              htmlFor={key}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())}
            </label>
          </div>
        ));
      }
    }

    return null;
  };

  return (
    <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
      <DialogContent className="sm:max-w-md" data-testid="export-modal">
        <DialogHeader className="flex flex-row items-center justify-between mb-2">
          <DialogTitle>{t("export_modal.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-3">{t("export_modal.include_breakdown_by")}</p>
            <div className="space-y-3">
              {renderCheckboxes()}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button
            variant="outline"
            onClick={() => setIsExportModalOpen(false)}
            data-testid="close-button"
            className="[border-color:hsl(var(--input))]"
          >
            {t("export_modal.close")}
          </Button>
          <Button
            onClick={handleExport}
            data-testid="export-button-modal"
            className="btn-outline-primary font-normal"
            variant="outline"
          >
            {t("export_modal.export")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

