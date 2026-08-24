import React from 'react';
import { getUserInfo } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Settings, 
  CreditCard, 
  Mail,
  Trash2,
  Phone,
  Save,
  ChevronDown,
  Edit2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { COUNTRIES } from "@/lib/countries";
import { Country, State, City } from "country-state-city";

const TAX_ID_LABELS = [
  "Australian Business Number (AU ABN)",
  "Australian Taxation Office Reference Number",
  "Brazil CNPJ number",
  "Brazil CPF number",
  "Bulgaria Unified Identification Code",
  "Canada BN",
  "Canada GST/HST number",
  "Canadian PST number (British Columbia)",
  "Canadian PST number (Manitoba)",
  "Canadian PST number (Saskatchewan)",
  "Canadian QST number (Québec)",
  "Chilean TIN",
  "Egyptian Tax Identification Number",
  "EU VAT number",
  "European One Stop Shop VAT number for non-Union scheme",
  "Georgian VAT",
  "Hong Kong BR number",
  "Hungary tax number (adószám)",
  "Icelandic VAT",
  "Indonesian NPWP number",
  "Indian GST number",
  "Israel VAT",
  "Japanese Corporate Number (Hōjin Bangō)",
  "Japanese Registered Foreign Businesses' Registration Number (Tōroku Kokugai Jigyōsha no Tōroku Bangō)",
  "Japanese Tax Registration Number (Tōroku Bangō)",
  "Kenya Revenue Authority Personal Identification Number",
  "Liechtensteinian UID number",
  "Malaysian FRP number",
  "Malaysian ITN",
  "Malaysian SST number",
  "Mexican RFC number",
  "New Zealand GST number",
  "Norwegian VAT number",
  "Pakistan NTN number",
  "Philippines Tax Identification Number",
  "Russian INN",
  "Russian KPP",
  "Saudi Arabia VAT",
  "Singaporean GST",
  "Singaporean UEN",
  "Slovenia tax number (davčna številka)",
  "South African VAT number",
  "South Korean BRN",
  "Spanish NIF number",
  "Switzerland VAT number",
  "Taiwanese VAT",
  "Thai VAT",
  "Turkish Tax Identification Number",
  "Ukrainian VAT",
  "United Arab Emirates TRN",
  "United Kingdom VAT number",
  "United States EIN",
  "Andorran NRT number",
  "Argentinian tax ID number",
  "Bolivian tax ID",
  "Chinese tax ID",
  "Colombian NIT number",
  "Costa Rican tax ID",
  "Dominican RCN number",
  "Ecuadorian RUC number",
  "Romanian tax ID number",
  "El Salvadorian NIT number",
  "Serbian PIB number",
  "Uruguayan RUC number",
  "Venezuelan RIF number",
  "Vietnamese tax ID number",
];
const TAX_ID_OTHER = "other";

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
  { value: 'America/Halifax', label: 'Atlantic Time (America/Halifax)' },
  { value: 'America/Toronto', label: 'Eastern - Toronto (America/Toronto)' },
  { value: 'America/Vancouver', label: 'Pacific - Vancouver (America/Vancouver)' },
  { value: 'America/Regina', label: 'Saskatchewan (America/Regina)' },
  { value: 'America/Mexico_City', label: 'Mexico City (America/Mexico_City)' },
  { value: 'America/Chihuahua', label: 'Chihuahua (America/Chihuahua)' },
  { value: 'America/Mazatlan', label: 'Mazatlan (America/Mazatlan)' },
  { value: 'America/Guatemala', label: 'Central America (America/Guatemala)' },
  { value: 'America/Bogota', label: 'Colombia (America/Bogota)' },
  { value: 'America/Lima', label: 'Peru (America/Lima)' },
  { value: 'America/Santiago', label: 'Chile (America/Santiago)' },
  { value: 'America/Sao_Paulo', label: 'Brasilia (America/Sao_Paulo)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (America/Argentina/Buenos_Aires)' },
  { value: 'America/Santa_Isabel', label: 'Baja California (America/Santa_Isabel)' },
  { value: 'America/Godthab', label: 'Greenland (America/Godthab)' },
  { value: 'Etc/GMT+12', label: 'International Date Line West (Etc/GMT+12)' },
  { value: 'Etc/GMT+11', label: 'Samoa (Etc/GMT+11)' },
  { value: 'Atlantic/Reykjavik', label: 'Reykjavik (Atlantic/Reykjavik)' },
  { value: 'Europe/London', label: 'London (Europe/London)' },
  { value: 'Europe/Lisbon', label: 'Lisbon (Europe/Lisbon)' },
  { value: 'Europe/Dublin', label: 'Dublin (Europe/Dublin)' },
  { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
  { value: 'Europe/Madrid', label: 'Madrid (Europe/Madrid)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (Europe/Amsterdam)' },
  { value: 'Europe/Brussels', label: 'Brussels (Europe/Brussels)' },
  { value: 'Europe/Rome', label: 'Rome (Europe/Rome)' },
  { value: 'Europe/Berlin', label: 'Berlin (Europe/Berlin)' },
  { value: 'Europe/Vienna', label: 'Vienna (Europe/Vienna)' },
  { value: 'Europe/Warsaw', label: 'Warsaw (Europe/Warsaw)' },
  { value: 'Europe/Sofia', label: 'Sofia (Europe/Sofia)' },
  { value: 'Europe/Athens', label: 'Athens (Europe/Athens)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (Europe/Helsinki)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (Europe/Istanbul)' },
  { value: 'Europe/Moscow', label: 'Moscow (Europe/Moscow)' },
  { value: 'Africa/Lagos', label: 'Lagos (Africa/Lagos)' },
  { value: 'Africa/Cairo', label: 'Cairo (Africa/Cairo)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (Africa/Nairobi)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (Africa/Johannesburg)' },
  { value: 'Asia/Baghdad', label: 'Baghdad (Asia/Baghdad)' },
  { value: 'Asia/Kuwait', label: 'Kuwait (Asia/Kuwait)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (Asia/Riyadh)' },
  { value: 'Asia/Dubai', label: 'Dubai (Asia/Dubai)' },
  { value: 'Asia/Tehran', label: 'Tehran (Asia/Tehran)' },
  { value: 'Asia/Kabul', label: 'Kabul (Asia/Kabul)' },
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi)' },
  { value: 'Asia/Tashkent', label: 'Tashkent (Asia/Tashkent)' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
  { value: 'Asia/Dhaka', label: 'Dhaka (Asia/Dhaka)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (Asia/Bangkok)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (Asia/Jakarta)' },
  { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (Asia/Kuala_Lumpur)' },
  { value: 'Asia/Manila', label: 'Manila (Asia/Manila)' },
  { value: 'Asia/Shanghai', label: 'Beijing/Shanghai (Asia/Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (Asia/Hong_Kong)' },
  { value: 'Asia/Seoul', label: 'Seoul (Asia/Seoul)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Asia/Tokyo)' },
  { value: 'Asia/Yekaterinburg', label: 'Ekaterinburg (Asia/Yekaterinburg)' },
  { value: 'Australia/Perth', label: 'Perth (Australia/Perth)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (Australia/Melbourne)' },
  { value: 'Australia/Sydney', label: 'Sydney (Australia/Sydney)' },
  { value: 'Pacific/Auckland', label: 'Auckland (Pacific/Auckland)' },
  { value: 'Pacific/Fiji', label: 'Fiji (Pacific/Fiji)' },
];

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


const AgencyGeneralSettings = () => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const dark = mode === "dark";
  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';
  const fieldLabel = dark ? 'text-slate-300' : 'text-slate-700';
  const rowBorder = dark ? 'border-slate-800' : 'border-slate-100';
  const inputCls = dark
    ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-slate-600'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300';
  const popSurface = dark ? 'bg-[#0f1829] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const primaryBtn = "px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm disabled:opacity-50";
  const outlineBtn = cn(
    "px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors",
    dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
  );

  const { data: agencyResponse, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}`);
      return res.json();
    }
  });

  const [generalData, setGeneralData] = useState({
    name: "",
    timezone: "",
    phone: "",
    phone_country_iso2: "",
  });

  const [billingData, setBillingData] = useState({
    billing_company: "",
    billing_person: "",
    tax_id: "",
    vat: "",
    address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      country_iso2: "PK"
    }
  });

  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({});
  // Tracks the dropdown's own selection, separate from billingData.tax_id — mirrors
  // the original app's tax_type/tax_id split: picking a preset label auto-fills
  // tax_id and locks it read-only; picking "Other" leaves tax_id freely editable.
  const [taxIdType, setTaxIdType] = useState("");

  const handleSaveBilling = () => {
    const errors: Record<string, string> = {};
    if (!billingData.billing_company?.trim()) errors.billing_company = t("agency.settings.billing.errors.company");
    if (!billingData.billing_person?.trim()) errors.billing_person = t("agency.settings.billing.errors.person");

    if (!billingData.address.country_iso2) {
      errors.country_iso2 = t("agency.settings.billing.errors.country");
    } else {
      const states = State.getStatesOfCountry(billingData.address.country_iso2);
      if (states.length > 0 && !billingData.address.state) {
         errors.state = t("agency.settings.billing.errors.state");
      }
      
      const cities = states.length > 0 
          ? (billingData.address.state ? City.getCitiesOfState(billingData.address.country_iso2, billingData.address.state) : [])
          : (City.getCitiesOfCountry(billingData.address.country_iso2) || []);
          
      if (cities.length > 0 && !billingData.address.city) {
         errors.city = t("agency.settings.billing.errors.city");
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setBillingErrors(errors);
      return;
    }
    
    setBillingErrors({});
    updateBillingMutation.mutate(billingData);
  };

  const [recipients, setRecipients] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");

  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneSearchQuery, setPhoneSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.code === "US")!);
  const [tempPhone, setTempPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

  const handleOpenPhoneModal = () => {
    let phonePart = generalData.phone || "";
    let foundCountry = selectedCountry;
    
    if (phonePart.startsWith("+")) {
      const matchedCountry = COUNTRIES.slice().sort((a,b) => b.dial.length - a.dial.length).find(c => phonePart.startsWith(c.dial));
      if (matchedCountry) {
        foundCountry = matchedCountry;
        phonePart = phonePart.slice(matchedCountry.dial.length).trim();
      }
    }
    
    setSelectedCountry(foundCountry);
    setTempPhone(phonePart);
    setPhoneError("");
    setIsPhoneModalOpen(true);
  };

  const handleSavePhone = () => {
    if (!tempPhone.trim()) {
      setPhoneError(t("agency.settings.general.phoneModal.label"));
      return;
    }
    setPhoneError("");
    setGeneralData({
      ...generalData,
      phone: `${selectedCountry.dial} ${tempPhone}`,
      phone_country_iso2: selectedCountry.code,
    });
    setIsPhoneModalOpen(false);
  };

  const handleSaveRecipient = () => {
    if (!newRecipient.trim() || recipients.includes(newRecipient.trim())) return;
    const updated = [...recipients, newRecipient.trim()];
    setRecipients(updated);
    setNewRecipient("");
    setIsAdding(false);
    updateGeneralMutation.mutate({ notification_email: updated.join(',') });
    toast({ title: t("agency.settings.recipients.added"), description: t("agency.settings.recipients.addedDesc") });
  };

  const handleDeleteRecipient = (index: number) => {
    const updated = recipients.filter((_, i) => i !== index);
    setRecipients(updated);
    updateGeneralMutation.mutate({ notification_email: updated.join(',') });
    toast({ title: t("agency.settings.recipients.deleted"), description: t("agency.settings.recipients.deletedDesc") });
  };

  useEffect(() => {
    if (agencyResponse?.agency) {
      const a = agencyResponse.agency;
      setGeneralData({
        name: a.name || "",
        timezone: a.timezone || "",
        phone: a.phone || "",
        phone_country_iso2: "",
      });
      setRecipients(
        a.notification_email
          ? a.notification_email.split(',').map((e: string) => e.trim()).filter(Boolean)
          : []
      );
      setBillingData({
        billing_company: a.billing_company || "",
        billing_person: a.billing_person || "",
        tax_id: a.tax_id || "",
        vat: a.vat || "",
        address: {
          street: a.address?.street || "",
          city: a.address?.city || "",
          state: a.address?.state || "",
          zip: a.address?.zip || "",
          country_iso2: a.address?.country_iso2 || "PK"
        }
      });
      setTaxIdType(
        !a.tax_id ? "" : TAX_ID_LABELS.includes(a.tax_id) ? a.tax_id : TAX_ID_OTHER
      );
    }
  }, [agencyResponse]);

  const updateGeneralMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/organizations/${agencyId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}`] });
      toast({ title: t("agency.settings.general.updated"), description: t("agency.settings.general.updatedDesc") });
    }
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/organizations/${agencyId}/billing`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}`] });
      toast({ title: t("agency.settings.billing.updated"), description: t("agency.settings.billing.updatedDesc") });
    }
  });

  
  return (
    <div className={cn("min-h-screen p-8 font-sans transition-colors duration-300 space-y-6", bg, text)}>

      {/* Settings Section */}
      <Card className={cn("rounded-[20px] border shadow-sm overflow-hidden transition-colors", card, border)}>
        <div className={cn("px-8 py-5 border-b flex items-center justify-between transition-colors", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className={cn("font-bold text-[15px] tracking-tight", text)}>{t("agency.settings.general.title")}</h2>
              <p className={cn("text-[11px] mt-0.5", sub)}>{t("agency.settings.general.desc")}</p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-0">
          <div className="px-8">
             <div className={cn("flex flex-col md:flex-row md:items-center py-5 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.general.name")}</span>
               </div>
               <div className="flex-1">
                 <Input
                   value={generalData.name}
                   onChange={(e) => setGeneralData({ ...generalData, name: e.target.value })}
                   placeholder="Your agency name"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}
                 />
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-5 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.general.timezone")}</span>
               </div>
               <div className="flex-1">
                 <Select
                   value={generalData.timezone}
                   onValueChange={(val) => setGeneralData({ ...generalData, timezone: val })}
                 >
                   <SelectTrigger className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}>
                     <SelectValue placeholder={t("agency.settings.general.selectTimezone")} />
                   </SelectTrigger>
                   <SelectContent className={cn("border shadow-2xl rounded-xl transition-colors max-h-[300px]", popSurface)}>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value} className="text-[13px]">{tz.label}</SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>

             <div className="flex flex-col md:flex-row md:items-center py-5">
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.general.phone")}</span>
               </div>
               <div className="flex-1">
                 <div className="relative">
                   <Input
                     value={generalData.phone}
                     readOnly
                     onClick={handleOpenPhoneModal}
                     placeholder="Add a phone number"
                     className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg pr-10 cursor-pointer", inputCls)}
                   />
                   <Edit2 className="absolute right-3 top-3 w-4 h-4 text-primary cursor-pointer" onClick={handleOpenPhoneModal} />
                 </div>
               </div>
             </div>
          </div>

          <div className={cn("px-8 py-4 border-t flex justify-end", border)}>
            <button
              onClick={() => updateGeneralMutation.mutate(generalData)}
              disabled={updateGeneralMutation.isPending}
              className={primaryBtn}>
              {updateGeneralMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Billing Details Section */}
      <Card className={cn("rounded-[20px] border shadow-sm overflow-hidden transition-colors", card, border)}>
        <div className={cn("px-8 py-5 border-b flex items-center gap-4 transition-colors", border)}>
          <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className={cn("font-bold text-[15px] tracking-tight", text)}>{t("agency.settings.billing.title")}</h2>
            <p className={cn("text-[11px] mt-0.5", sub)}>{t("agency.settings.billing.desc")}</p>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="px-8">
             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.company")}</span>
               </div>
               <div className="flex-1">
                 <Input
                   value={billingData.billing_company}
                   onChange={(e) => {
                     setBillingData({ ...billingData, billing_company: e.target.value });
                     if (e.target.value) setBillingErrors(prev => ({ ...prev, billing_company: "" }));
                   }}
                   placeholder="Legal company name"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg",
                     billingErrors.billing_company && "border-red-400 focus-visible:ring-red-400",
                     inputCls)}
                 />
                 {billingErrors.billing_company && <div className="text-red-400 text-[12px] italic mt-1.5">{billingErrors.billing_company}</div>}
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.person")}</span>
               </div>
               <div className="flex-1">
                 <Input
                   value={billingData.billing_person}
                   onChange={(e) => {
                     setBillingData({ ...billingData, billing_person: e.target.value });
                     if (e.target.value) setBillingErrors(prev => ({ ...prev, billing_person: "" }));
                   }}
                   placeholder="Full name of billing contact"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg",
                     billingErrors.billing_person && "border-red-400 focus-visible:ring-red-400",
                     inputCls)}
                 />
                 {billingErrors.billing_person && <div className="text-red-400 text-[12px] italic mt-1.5">{billingErrors.billing_person}</div>}
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.taxId")}</span>
               </div>
               <div className="flex-1">
                 <Select
                   value={taxIdType}
                   onValueChange={(val) => {
                     setTaxIdType(val);
                     setBillingData({ ...billingData, tax_id: val === TAX_ID_OTHER ? "" : val });
                   }}
                 >
                   <SelectTrigger className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}>
                     <SelectValue placeholder={t("agency.settings.billing.selectTaxId")} />
                   </SelectTrigger>
                   <SelectContent className={cn("border shadow-2xl rounded-xl transition-colors max-h-[300px]", popSurface)}>
                     <SelectItem value={TAX_ID_OTHER} className="text-[13px]">Other</SelectItem>
                     {TAX_ID_LABELS.map(label => (
                       <SelectItem key={label} value={label} className="text-[13px]">{label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.taxIdName")}</span>
               </div>
               <div className="flex-1 grid grid-cols-2 gap-4">
                 <Input
                   value={billingData.tax_id}
                   onChange={(e) => setBillingData({ ...billingData, tax_id: e.target.value })}
                   readOnly={taxIdType !== TAX_ID_OTHER && taxIdType !== ""}
                   placeholder="NTN / Tax ID"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg",
                     taxIdType !== TAX_ID_OTHER && taxIdType !== "" && "opacity-60 cursor-not-allowed",
                     inputCls)}
                 />
                 <Input
                   value={billingData.vat}
                   onChange={(e) => setBillingData({ ...billingData, vat: e.target.value })}
                   placeholder="VAT / STRN (optional)"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}
                 />
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.address")}</span>
               </div>
               <div className="flex-1">
                 <Input
                   value={billingData.address.street}
                   onChange={(e) => setBillingData({ ...billingData, address: { ...billingData.address, street: e.target.value } })}
                   placeholder="Street address"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}
                 />
               </div>
             </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
                <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                  <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.country")}</span>
                </div>
                <div className="flex-1">
                  <Select
                    value={billingData.address.country_iso2}
                    onValueChange={(val) => {
                      setBillingData({ ...billingData, address: { ...billingData.address, country_iso2: val, state: "", city: "" } });
                      if (val) setBillingErrors(prev => ({ ...prev, country_iso2: "" }));
                    }}
                  >
                    <SelectTrigger className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg",
                      billingErrors.country_iso2 && "border-red-400 focus-visible:ring-red-400",
                      inputCls)}>
                      <SelectValue placeholder={t("agency.settings.billing.selectCountry")} />
                    </SelectTrigger>
                    <SelectContent className={cn("border shadow-2xl rounded-xl transition-colors max-h-[300px]", popSurface)}>
                      {Country.getAllCountries().map(country => (
                        <SelectItem key={country.isoCode} value={country.isoCode} className="text-[13px]">
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {billingErrors.country_iso2 && <div className="text-red-400 text-[12px] italic mt-1.5">{billingErrors.country_iso2}</div>}
                </div>
              </div>

              <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
                <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                  <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.state")}</span>
                </div>
                <div className="flex-1">
                  <Select
                    value={billingData.address.state}
                    onValueChange={(val) => {
                      setBillingData({ ...billingData, address: { ...billingData.address, state: val, city: "" } });
                      if (val) setBillingErrors(prev => ({ ...prev, state: "" }));
                    }}
                    disabled={!billingData.address.country_iso2}
                  >
                    <SelectTrigger className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg disabled:opacity-50",
                      billingErrors.state && "border-red-400 focus-visible:ring-red-400",
                      inputCls)}>
                      <SelectValue placeholder={t("agency.settings.billing.selectState")} />
                    </SelectTrigger>
                    <SelectContent className={cn("border shadow-2xl rounded-xl transition-colors max-h-[300px]", popSurface)}>
                      {billingData.address.country_iso2 && State.getStatesOfCountry(billingData.address.country_iso2).map(state => (
                        <SelectItem key={state.isoCode} value={state.isoCode} className="text-[13px]">
                          {state.name}
                        </SelectItem>
                      ))}
                      {billingData.address.country_iso2 && State.getStatesOfCountry(billingData.address.country_iso2).length === 0 && (
                        <SelectItem value="none" disabled className="text-[13px]">{t("agency.settings.billing.noStates")}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {billingErrors.state && <div className="text-red-400 text-[12px] italic mt-1.5">{billingErrors.state}</div>}
                </div>
              </div>

              <div className={cn("flex flex-col md:flex-row md:items-center py-4 border-b", rowBorder)}>
                <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                  <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.city")}</span>
                </div>
                <div className="flex-1">
                  <Select
                    value={billingData.address.city}
                    onValueChange={(val) => {
                      setBillingData({ ...billingData, address: { ...billingData.address, city: val } });
                      if (val) setBillingErrors(prev => ({ ...prev, city: "" }));
                    }}
                    disabled={!billingData.address.country_iso2 || (!billingData.address.state && State.getStatesOfCountry(billingData.address.country_iso2).length > 0)}
                  >
                    <SelectTrigger className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg disabled:opacity-50",
                      billingErrors.city && "border-red-400 focus-visible:ring-red-400",
                      inputCls)}>
                      <SelectValue placeholder={t("agency.settings.billing.selectCity")} />
                    </SelectTrigger>
                    <SelectContent className={cn("border shadow-2xl rounded-xl transition-colors max-h-[300px]", popSurface)}>
                      {billingData.address.country_iso2 && (
                        State.getStatesOfCountry(billingData.address.country_iso2).length > 0 
                          ? billingData.address.state ? City.getCitiesOfState(billingData.address.country_iso2, billingData.address.state) : []
                          : City.getCitiesOfCountry(billingData.address.country_iso2) || []
                      ).map((city, index) => (
                        <SelectItem key={`${city.name}-${index}`} value={city.name} className="text-[13px]">
                          {city.name}
                        </SelectItem>
                      ))}
                      {billingData.address.country_iso2 && (
                        State.getStatesOfCountry(billingData.address.country_iso2).length > 0 
                          ? billingData.address.state ? City.getCitiesOfState(billingData.address.country_iso2, billingData.address.state) : []
                          : City.getCitiesOfCountry(billingData.address.country_iso2) || []
                      ).length === 0 && (
                        <SelectItem value="none" disabled className="text-[13px]">{t("agency.settings.billing.noCities")}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {billingErrors.city && <div className="text-red-400 text-[12px] italic mt-1.5">{billingErrors.city}</div>}
                </div>
              </div>

             <div className={cn("flex flex-col md:flex-row md:items-center py-4")}>
               <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                 <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.billing.zip")}</span>
               </div>
               <div className="flex-1">
                 <Input
                   value={billingData.address.zip}
                   onChange={(e) => setBillingData({ ...billingData, address: { ...billingData.address, zip: e.target.value } })}
                   placeholder="Zip / Postal code"
                   className={cn("text-[13px] h-10 transition-colors shadow-none rounded-lg", inputCls)}
                 />
               </div>
             </div>
          </div>

          <div className={cn("px-8 py-4 border-t flex justify-end", border)}>
            <button
              onClick={handleSaveBilling}
              disabled={updateBillingMutation.isPending}
              className={primaryBtn}>
              {updateBillingMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Recipients Section */}
      <Card className={cn("rounded-[20px] border shadow-sm overflow-hidden transition-colors", card, border)}>
        <div className={cn("px-8 py-5 border-b flex items-center gap-4 transition-colors", border)}>
          <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className={cn("font-bold text-[15px] tracking-tight", text)}>{t("agency.settings.recipients.title")}</h2>
            <p className={cn("text-[11px] mt-0.5", sub)}>{t("agency.settings.recipients.desc")}</p>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="px-8 py-4 space-y-4">
            {recipients.map((recipient, index) => (
              <div key={index} className={cn("flex flex-col md:flex-row md:items-center py-2 border-b", rowBorder)}>
                <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                  <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.recipients.label")} {index + 1}</span>
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    value={recipient}
                    readOnly
                    className={cn("text-[13px] h-10 flex-1 transition-all rounded-lg shadow-none", inputCls)}
                  />
                  <button
                    onClick={() => handleDeleteRecipient(index)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors shadow-sm",
                      dark
                        ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                        : "border-red-200 text-red-600 hover:bg-red-50"
                    )}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}

            {isAdding ? (
              <div className="flex flex-col md:flex-row md:items-center py-2 animate-in fade-in slide-in-from-left-2">
                <div className="w-[250px] shrink-0 mb-2 md:mb-0">
                  <span className={cn("text-[12px] font-semibold", fieldLabel)}>{t("agency.settings.recipients.new")}</span>
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="name@company.com"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    className={cn("text-[13px] h-10 flex-1 transition-all rounded-lg shadow-none", inputCls)}
                  />
                  <button
                    onClick={handleSaveRecipient}
                    className={primaryBtn}
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    className={outlineBtn}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 pb-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className={primaryBtn}
                >
                  {t("agency.settings.recipients.add")}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPhoneModalOpen} onOpenChange={setIsPhoneModalOpen}>
        <DialogContent className={cn("sm:max-w-[450px] p-0 border overflow-hidden shadow-2xl rounded-2xl", popSurface)}>
          <DialogHeader className={cn("px-6 py-4 border-b", border)}>
            <DialogTitle className={cn("text-[15px] font-bold", text)}>{t("agency.settings.general.phoneModal.title")}</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-3">
            <label className={cn("text-[12px] font-semibold", fieldLabel)}>
              {t("agency.settings.general.phoneModal.label")}
            </label>
            <div className="flex flex-col gap-3">
              <div className={cn("flex items-center flex-1 rounded-lg border transition-colors focus-within:ring-1",
                phoneError ? "border-red-400 focus-within:ring-red-400" :
                dark ? "bg-slate-900/60 border-slate-700 focus-within:ring-slate-600" : "bg-slate-50 border-slate-200 focus-within:ring-slate-300")}>

                <Popover open={isCountryDropdownOpen} onOpenChange={setIsCountryDropdownOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn("flex items-center gap-2 pl-3 pr-2 py-2 h-10 border-r focus:outline-none transition-colors",
                      phoneError ? "border-red-400" : dark ? "border-slate-700 hover:bg-slate-800/50" : "border-slate-200 hover:bg-slate-100")}>
                      <img src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} width="20" alt={selectedCountry.name} className="shadow-sm rounded-[2px]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={cn("w-[280px] p-0 shadow-2xl border rounded-xl", popSurface)}
                    align="start"
                  >
                    <div className={cn("p-2 border-b", border)}>
                      <div className="relative">
                        <Search className={cn("absolute left-2.5 top-2.5 h-4 w-4", sub)} />
                        <Input
                          placeholder={t("common.search")}
                          value={phoneSearchQuery}
                          onChange={(e) => setPhoneSearchQuery(e.target.value)}
                          className={cn("h-9 pl-9 text-[13px] shadow-none rounded-lg", inputCls)}
                        />
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1 overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                      {COUNTRIES.filter(c =>
                        c.name.toLowerCase().includes(phoneSearchQuery.toLowerCase()) ||
                        c.dial.includes(phoneSearchQuery)
                      ).map((country) => (
                        <button
                          key={country.code}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setSelectedCountry(country);
                            setIsCountryDropdownOpen(false);
                            setPhoneSearchQuery("");
                          }}
                          className={cn("w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg text-left transition-colors",
                            dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700",
                            selectedCountry.code === country.code && (dark ? "bg-slate-800 font-medium" : "bg-slate-100 font-medium")
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <img src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width="16" alt={country.name} className="shadow-sm rounded-[2px]" />
                            <span>{country.name} ({country.dial})</span>
                          </div>
                        </button>
                      ))}
                      {COUNTRIES.filter(c => c.name.toLowerCase().includes(phoneSearchQuery.toLowerCase()) || c.dial.includes(phoneSearchQuery)).length === 0 && (
                        <div className={cn("p-3 text-center text-[13px]", sub)}>{t("agency.settings.general.phoneModal.noCountries")}.</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Input 
                  value={tempPhone}
                  onChange={(e) => {
                    setTempPhone(e.target.value);
                    if (e.target.value.trim()) setPhoneError("");
                  }}
                  placeholder={
                    selectedCountry.code === "US" || selectedCountry.code === "CA" ? t("agency.settings.general.phoneModal.placeholder_us") :
                    selectedCountry.code === "PK" ? t("agency.settings.general.phoneModal.placeholder_pk") :
                    selectedCountry.code === "IN" ? t("agency.settings.general.phoneModal.placeholder_in") :
                    selectedCountry.code === "GB" ? t("agency.settings.general.phoneModal.placeholder_gb") :
                    selectedCountry.code === "AU" ? t("agency.settings.general.phoneModal.placeholder_au") :
                    selectedCountry.code === "FR" ? t("agency.settings.general.phoneModal.placeholder_fr") :
                    selectedCountry.code === "DE" ? t("agency.settings.general.phoneModal.placeholder_de") :
                    selectedCountry.code === "AE" ? t("agency.settings.general.phoneModal.placeholder_ae") :
                    selectedCountry.code === "SA" ? t("agency.settings.general.phoneModal.placeholder_sa") :
                    t("agency.settings.general.phoneModal.placeholder_default")
                  }
                  className={cn("flex-1 h-10 border-0 focus-visible:ring-0 text-[13px] bg-transparent", text)}
                />
              </div>
              {phoneError && <div className="text-red-400 text-[12px] italic">{phoneError}</div>}
            </div>
          </div>

          <div className={cn("px-6 py-4 border-t flex justify-end gap-2", border)}>
            <button
              onClick={() => setIsPhoneModalOpen(false)}
              className={outlineBtn}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSavePhone}
              className={primaryBtn}
            >
              {t("common.save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyGeneralSettings;
