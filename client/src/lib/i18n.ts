import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enJson from '../i18n/locales/en.json';
import ptJson from '../i18n/locales/pt.json';
import esJson from '../i18n/locales/es.json';
import arJson from '../i18n/locales/ar.json';
import frJson from '../i18n/locales/fr.json';
import deJson from '../i18n/locales/de.json';
import hiJson from '../i18n/locales/hi.json';
import urJson from '../i18n/locales/ur.json';
import zhJson from '../i18n/locales/zh.json';
import jaJson from '../i18n/locales/ja.json';
import ruJson from '../i18n/locales/ru.json';
import trJson from '../i18n/locales/tr.json';
import itJson from '../i18n/locales/it.json';
import idJson from '../i18n/locales/id.json';
import viJson from '../i18n/locales/vi.json';

const resources = {
  en: {
    translation: {
      "common": {
        "save": "Save",
        "cancel": "Cancel",
        "update": "Update",
        "delete": "Delete",
        "search": "Search",
        "searchPlaceholder": "Search...",
        "documentation": "Documentation",
        "quickSetup": "Quick Setup",
        "openDocs": "Open docs",
        "startNow": "Start now",
        "live": "LIVE",
        "saving": "Saving...",
        "active": "Active",
        "archived": "Archived",
        "archive": "Archive",
        "manage": "Manage",
        "activate": "Activate",
        "login": "Login",
        "suspend": "Suspend",
        "suspended": "Suspended",
        "recommendedSize": "Recommended size",
        "remove": "remove",
        "uploadNew": "Upload new",
        "selectFromGallery": "Select from gallery",
        "connect": "Connect",
        "connecting": "Connecting...",
        "connectNow": "Connect now",
        "continue": "Continue",
        "importantNote": "Important Note:",
        "search_label": "Search",
        "no_results": "No results found",
        "comingSoon": "COMING SOON",
        "joinWaitlist": "Join waitlist",
        "approved": "APPROVED",
        "manageListing": "Manage listing",
        "included": "INCLUDED",
        "openCommunity": "Open community",
        "enterprise": "ENTERPRISE",
        "viewPlanDetails": "View plan details",
        "upgrade": "Upgrade",
        "error": "Error",
        "languages": {
          "en": "English (U.S)",
          "es": "Spanish (España)",
          "pt": "Português (Brasil)"
        },
        "agree": "I agree",
        "copy": "Copy",
        "copied": "Copied",
        "readMore": "Read more",
        "saved": "Saved",
        "errorDesc": "Something went wrong. Please try again.",
        "month": "month",
        "add": "Add",
        "total": "Total",
        "current": "Current",
        "peak": "Peak",
        "incoming": "Incoming",
        "outgoing": "Outgoing",
        "close": "Close",
        "yes": "Yes",
        "no": "No"
      },
      "nav": {
        "dashboard": "Dashboard",
        "workspaces": "Workspaces",
        "team": "Team",
        "roles": "Roles & Permissions",
        "auditLogs": "Audit Logs",
        "auditLogs_agency": "Organization",
        "saas": "SaaS",
        "saas_plans": "Plans",
        "saas_api": "API",
        "billing": "Billing",
        "billing_plans": "Plans",
        "billing_manage": "Manage",
        "legal": "Legal",
        "help": "Help",
        "settings": "Organization Settings",
        "settings_general": "General settings",
        "settings_notifications": "Notifications",
        "settings_whiteLabel": "White Label",
        "profile": "Profile",
        "signOut": "Sign out"
      },
      "agency": {
        "dashboard": {
          "greeting": {
            "morning": "Good morning",
            "afternoon": "Good afternoon",
            "evening": "Good evening"
          },
          "summary": "Here's what's happening across your organization today.",
          "stats": {
            "workspaces": "Total of Workspaces",
            "agents": "Agents in the Organization",
            "support": "Premium Support Seats"
          },
          "features": {
            "title": "Organization features",
            "manageAll": "Manage all",
            "whiteLabel": {
              "title": "Organization White Label",
              "desc": "Your brand, your domain, your organization."
            },
            "saas": {
              "title": "SaaS Mode",
              "desc": "Offer Ezconn as a subscription product."
            },
            "marketplace": {
              "title": "Marketplace",
              "desc": "List your services and integrations for users."
            },
            "community": {
              "title": "Community Access",
              "desc": "Network with 10,000+ organization operators."
            },
            "plan": {
              "title": "Your Plan",
              "desc": "Enterprise — Next billing: 2026-05-11."
            }
          },
          "quickActions": {
            "title": "Quick actions",
            "createWorkspace": {
              "title": "Create workspace",
              "sub": "Set up a new client workspace."
            },
            "inviteTeam": {
              "title": "Invite team member",
              "sub": "Add agents to your organization."
            },
            "settings": {
              "sub": "Branding, domains, billing."
            },
            "auditLogs": {
              "title": "View audit logs",
              "sub": "Track every change in real time."
            }
          },
          "activity": {
            "title": "Recent Activity",
            "viewAll": "View all organization logs",
            "actions": {
              "createdWorkspace": "created a workspace",
              "subscriptionUpgraded": "Subscription upgraded from ignite-plan to enterprise-plan."
            }
          },
          "documentation": {
            "desc": "Explore the system features, APIs, and integrations in one place"
          },
          "quickSetup": {
            "desc": "Get started quickly with our step-by-step onboarding guide"
          },
          "plan_card": {
            "enterprise_title": "ENTERPRISE PLAN",
            "enterprise": "Enterprise",
            "next_payment": "Next Payment",
            "workspaces_used": "Workspaces used"
          }
        },
        "api": {
          "title": "API",
          "desc": "Manage your API credential",
          "view_instructions": "View instructions",
          "key_title": "API Key",
          "key_desc_empty": "Generate your API key to connect with external applications and automate your workflow.",
          "generate_key": "Generate key",
          "your_key_title": "Your API Key",
          "your_key_desc": "Here is your API key for connecting with external applications",
          "regenerate_key": "Regenerate Key",
          "generated_toast": "API Key Generated",
          "generated_desc": "Your new API key has been generated successfully.",
          "copied_desc": "API key copied to clipboard"
        },
        "help": {
          "chat": {
            "title": "Organization Live Chat Support",
            "desc": "Access direct help from our team via live chat for immediate assistance.",
            "btn": "Open Chat"
          },
          "kb": {
            "title": "Organization Knowledge Base",
            "desc": "Comprehensive guides and documentation to master all organization features."
          },
          "tutorials": {
            "title": "Video Tutorials",
            "desc": "Step-by-step video guides to help you set up and scale your organization.",
            "btn": "Watch Tutorials"
          },
          "api": {
            "title": "API Reference",
            "desc": "Full technical documentation for our Organization API and integrations.",
            "btn": "View Docs"
          }
        },
        "settings": {
          "general": {
            "title": "Settings",
            "desc": "Control the preferences and settings",
            "name": "Name",
            "timezone": "Timezone",
            "selectTimezone": "Select timezone",
            "phone": "Phone number",
            "updated": "Settings Updated",
            "updatedDesc": "General settings have been updated successfully.",
            "whiteLabel": {
              "title": "White Label",
              "replaceBrand": "Replace our brand with your own organization brand!",
              "features": "Features",
              "logo": "Logo",
              "favicon": "Favicon",
              "colors": "Colors",
              "domain": "Domain",
              "logo_info_light": "The logos displayed in this Organization account and as the default logo in Workspaces when the agent selects light mode. Please note that you can assign specific logos directly to specific Workspaces. This change will not affect custom logos in active Workspaces.",
              "logo_info_dark": "The logos displayed in this Organization account and as the default logo in Workspaces when the agent selects dark mode. Please note that you can assign specific logos directly to specific Workspaces. This change will not affect custom logos in active Workspaces.",
              "email": "Notification E-mail",
              "personalize": "Personalize your Workspaces with your logo, colors and chatbotsystem.ai domain.",
              "fullLogo": "Full wide logo",
              "smallLogo": "Small logo",
              "emailDesc": "Integrate your e-mail to send branded agent invitation and forgot password emails.",
              "customize": "Customize your Organization Logo, Colors and Domain.",
              "logoDisplay": "Your organization logo will be displayed in all of your workspaces.",
              "colorDisplay": "Your organization colors will be displayed in all of your workspaces.",
              "emailUsage": "Your organization e-mail can be used from your Workspaces.",
              "whiteLabelAll": "Display your organization logo, colors, emails and the generic *.chatbotsystem.ai domain to White Label all your Workspaces.",
              "customDomainNote": "This custom domain applies to the organization level, not individual workspaces. To change the domain for specific workspaces, head over to their settings directly.",
              "makeShine": "Make your Organization shine with your own custom domain!",
              "ditchBrand": "This section lets you ditch our brand and use your organization's domain name. This adds a professional touch and builds trust with your Organization employees.",
              "enterDomain": "Enter the domain to send from",
              "emailIntegrate": "Integrate your e-mail to send branded agent invitation and forgot password emails.",
              "selectColor": "Select the color that will be set to your account and Workspaces.",
              "uploadFavicon": "Upload the favicon that will be displayed at the browsers tab."
            },
            "phoneModal": {
              "title": "Update mobile number",
              "label": "Enter mobile number",
              "noCountries": "No countries found",
              "placeholder_us": "(407) 231-1234",
              "placeholder_pk": "333 2345678",
              "placeholder_in": "98765 43210",
              "placeholder_gb": "7911 123456",
              "placeholder_au": "412 345 678",
              "placeholder_fr": "6 12 34 56 78",
              "placeholder_de": "1512 3456789",
              "placeholder_ae": "50 123 4567",
              "placeholder_sa": "50 123 4567",
              "placeholder_default": "123 456 7890"
            },
            "timezones": {
              "fortaleza": "Fortaleza",
              "gmt_12": "International Date Line West",
              "gmt_11": "Coordinated Universal Time 11",
              "hawaii": "Hawaii",
              "alaska": "Alaska",
              "baja": "Baja California",
              "pacific": "Pacific Time (US and Canada)",
              "chihuahua": "Chihuahua, La Paz",
              "mazatlan": "Mazatlan",
              "arizona": "Arizona",
              "mountain": "Mountain Time (US and Canada)",
              "central_am": "Central America",
              "central": "Central Time (US and Canada)",
              "saskatchewan": "Saskatchewan"
            }
          },
          "billing": {
            "title": "Billing Details",
            "desc": "Details that will be shown on your invoices",
            "company": "Company Name",
            "person": "Person Responsible",
            "taxId": "Tax ID",
            "vat": "VAT",
            "selectTaxId": "Select a Tax ID",
            "taxIdName": "Tax ID / VAT",
            "address": "Address",
            "country": "Country",
            "state": "State",
            "city": "City",
            "zip": "Zip Code",
            "selectCountry": "Select Country",
            "selectState": "Select State",
            "selectCity": "Select City",
            "noStates": "No states available",
            "noCities": "No cities available",
            "updated": "Billing Details Updated",
            "updatedDesc": "Your billing information has been saved.",
            "errors": {
              "company": "Company name is required",
              "person": "Responsible person is required",
              "taxNumber": "Tax number is required",
              "taxType": "Tax ID type is required",
              "country": "Country is required",
              "state": "State is required",
              "city": "City is required"
            },
            "taxTypes": {
              "other": "Other",
              "au_abn": "Australian Business Number (AU ABN)",
              "au_trn": "Australian Taxation Office Reference Number",
              "br_cnpj": "Brazil CNPJ number",
              "br_cpf": "Brazil CPF number",
              "bg_uic": "Bulgaria Unified Identification Code",
              "ca_bn": "Canada BN",
              "ca_gst_hst": "Canada GST/HST number",
              "ca_pst_bc": "Canadian PST number (British Columbia)",
              "ca_pst_mb": "Canadian PST number (Manitoba)",
              "ca_pst_sk": "Canadian PST number (Saskatchewan)",
              "ca_qst_qc": "Canadian QST number (Québec)",
              "cl_tin": "Chilean TIN",
              "eg_tin": "Egyptian Tax Identification Number",
              "eu_vat": "EU VAT number",
              "eu_oss_vat": "European One Stop Shop VAT number for non-Union scheme",
              "ge_vat": "Georgian VAT",
              "hk_br": "Hong Kong BR number",
              "hu_tin": "Hungary tax number (adószám)",
              "in_gstin": "India GSTIN",
              "id_npwp": "Indonesian NPWP",
              "il_vat": "Israel VAT",
              "jp_trn": "Japan TRN",
              "ke_pin": "Kenya PIN",
              "my_sst": "Malaysia SST",
              "mx_rfc": "Mexico RFC",
              "nz_gst": "New Zealand GST",
              "no_vat": "Norway VAT",
              "om_vat": "Oman VAT",
              "ru_inn": "Russia INN",
              "sa_vat": "Saudi Arabia VAT",
              "rs_vat": "Serbia VAT",
              "sg_gst": "Singapore GST",
              "za_vat": "South Africa VAT",
              "kr_brn": "South Korea BRN",
              "ch_vat": "Switzerland VAT",
              "tw_vat": "Taiwan VAT",
              "th_vat": "Thailand VAT",
              "tr_vat": "Turkey VAT",
              "ua_vat": "Ukraine VAT",
              "ae_trn": "United Arab Emirates TRN",
              "gb_vat": "United Kingdom VAT",
              "us_ein": "United States EIN"
            }
          },
          "recipients": {
            "title": "Invoice Recipients",
            "desc": "Add people to receive a copy of your invoices",
            "label": "Recipient #",
            "new": "New Recipient",
            "add": "Add an invoice recipient",
            "added": "Recipient Added",
            "addedDesc": "Invoice recipient added successfully.",
            "deleted": "Recipient Deleted",
            "deletedDesc": "Invoice recipient removed."
          },
          "notifications": {
            "title": "Notifications",
            "email": "Notification E-mail",
            "emailDesc": "This email will be used to send all system and activity notifications.",
            "language": "Notification Language",
            "languageDesc": "The selected language will be applied to all email notifications.",
            "selectLanguage": "Select language",
            "updated": "Notification settings updated"
          }
        },
        "logs": {
          "title": "Organization Logs",
          "categories": {
            "workspace_created": "Workspace created",
            "workspace_deleted": "Workspace deleted",
            "contacts_limit_changed": "Contacts limit changed",
            "contacts_limit_enabled": "Contacts limit enabled",
            "contacts_limit_disabled": "Contacts limit disabled",
            "subscription_upgraded": "Subscription Upgraded",
            "subscription_cancelled": "Subscription cancelled",
            "whitelabel_purchased": "Whitelabel purchased",
            "whitelabel_cancelled": "White label cancelled",
            "ai_assistants": "AI Chat assistants"
          },
          "filters": {
            "today": "Today",
            "yesterday": "Yesterday",
            "last_7_days": "Last 7 Days",
            "last_30_days": "Last 30 Days",
            "select_agents": "Select agents",
            "all_agents": "All Agents"
          },
          "table": {
            "action_date": "ACTION DATE",
            "action": "ACTION",
            "performed_by": "PERFORMED BY",
            "loading": "Loading logs...",
            "empty": "No logs found"
          },
          "pagination": {
            "showing": "Showing {{start}} to {{end}} of {{total}} rows"
          }
        },
        "auditLogs": {
          "title": "Audit Logs",
          "categories": {
            "login": "Agent logged in",
            "logout": "Logged out",
            "add_agent": "Added agent",
            "agent_joined": "Agent joined",
            "create_team": "Created a team",
            "update_team": "Updated a team",
            "delete_team": "Deleted a team",
            "add_team_member": "Added team member",
            "delete_team_member": "Deleted team member",
            "add_channel": "Added a channel",
            "delete_channel": "Deleted a channel",
            "flow_created": "Smart Flow created",
            "flow_updated": "Smart Flow updated",
            "flow_deleted": "Smart Flow deleted",
            "flow_archived": "Smart Flow archived",
            "flow_activated": "Smart Flow activated",
            "call_forwarding": "Changed call forwarding",
            "add_domain": "Added a domain",
            "pipeline_created": "pipeline created",
            "pipeline_deleted": "pipeline deleted",
            "field_created": "Custom field created",
            "change_password": "Changed password",
            "ai_assistants": "AI Chat assistants",
            "whitelabel_purchased": "Purchased White Label",
            "whitelabel_cancelled": "Cancelled white label"
          },
          "filters": {
            "all_workspaces": "All Workspaces",
            "today": "Today",
            "yesterday": "Yesterday",
            "last_7_days": "Last 7 Days",
            "last_30_days": "Last 30 Days"
          },
          "table": {
            "workspace": "Workspace",
            "action_date": "Action Date",
            "action": "Action",
            "performed_by": "Performed By",
            "loading": "Loading logs...",
            "empty": "No logs found for selected filters"
          },
          "pagination": {
            "showing": "Showing {{count}} of {{total}} rows"
          }
        },
        "voiceWallet": {
          "title": "Voice Wallet: {{name}}",
          "desc": "Manage AI Voice Assistants credits and billing.",
          "balance": {
            "title": "Current Balance",
            "fetching": "Fetching balance...",
            "minutes": "Minutes",
            "seconds": "Seconds",
            "available": "Available Credits",
            "info": "Credits are used for AI Voice calls. 1 minute of AI Voice processing costs 1 credit. Credits do not expire as long as the workspace is active."
          },
          "purchase": {
            "title": "Buy Voice Credits",
            "select_amount": "Select Credits Amount",
            "amount_desc": "Choose between 100 and 10,000 minutes",
            "total_pay": "Total Amount to Pay",
            "price_per_min": "Price per minute: ${{price}}",
            "complete_btn": "Complete Purchase",
            "processing": "Processing...",
            "terms": "By clicking \"Complete Purchase\", you agree to our terms of service. The amount will be charged to your saved payment method.",
            "success_title": "Purchase Successful",
            "success_desc": "Successfully added {{amount}} minutes to {{name}}'s wallet."
          }
        },
        "workspaces": {
          "title": "Workspaces",
          "desc": "Workspaces (sub-accounts) belonging to either you or your customers.",
          "add": "Add Workspace",
          "searchPlaceholder": "Search workspaces, teams...",
          "showInactive": "Show inactive",
          "sortNewest": "Newest first",
          "sortOldest": "Oldest first",
          "filter": {
            "showInactive": "Show inactive",
            "fromNewest": "From newest",
            "fromOldest": "From oldest"
          },

          "table": {
            "name": "NAME",
            "login": "LOGIN",
            "createdAt": "CREATED AT",
            "status": "STATUS",
            "action": "ACTION"
          },
          "empty": "No Workspace found",
          "usage": {
            "title_for": "Usage: {{name}}",
            "desc": "Check the consumption and billing details of this workspace.",
            "period": "Current Billing Period",
            "next_billing": "Next billing: {{date}}",
            "agents": "Agents",
            "agents_desc": "Team members with access",
            "contacts": "Active Contacts",
            "contacts_desc": "Unique contacts with conversations",
            "total_period": "Total for this period",
            "channel_stats": "Channel activity",
            "history": "Billing History",
            "download_invoice": "Download Invoice",
            "empty_history": "No history available"
          },
          "wallet": "AI Voice Credits Wallet",
          "messages": {
            "statusUpdated": "Status Updated to {{status}}",
            "statusDesc": "Workspace {{name}} has been successfully {{status}}.",
            "deleted": "Workspace Deleted",
            "deletedDesc": "Workspace {{name}} has been removed.",
            "deleteConfirm": "Are you sure you want to delete workspace {{name}}? This action cannot be undone.",
            "loggingIn": "Logging in...",
            "redirecting": "Redirecting to {{name}} dashboard..."
          },
          "form": {
            "edit_title": "Edit workspace",
            "add_title": "Add a workspace",
            "edit_desc": "Editing settings for {{name}}",
            "add_desc": "Create distinct sub-accounts, also known as workspaces, either for yourself or for your clients.",
            "name_label": "Workspace name",
            "domain_label": "Domain",
            "domain_placeholder": "domain",
            "assign_agent": "Assign an organization Agent to this workspace",
            "select_agent": "Select agent",
            "enable_white_label": "Enable White Label for this workspace",
            "allow_support": "Allow support to login to workspace",
            "limit_contacts": "Limit of Active contacts",
            "limit_agents": "Limit of Agents",
            "max_ai_assistants": "Maximum number of Active AI Chat Assistants",
            "included_in_plan": "Included in plan : {{count}}",
            "additional_free": "Additional connections: $0 ea.",
            "connection_limit": "Connection Limit",
            "created": "Workspace Created",
            "updated": "Workspace Updated",
            "created_desc": "Successfully created the workspace",
            "updated_desc": "Successfully updated the workspace",
            "save_error": "Failed to save workspace",
            "name_required": "Workspace name is required"
          },
          "features": {
            "whatsapp_api": "WhatsApp Business API",
            "pilot_free": "Pilot connection: FREE",
            "additional_whatsapp": "Additional connections: $4 ea.",
            "instagram": "Instagram",
            "additional_10": "Additional connections: $10 ea.",
            "messenger": "Messenger",
            "telegram": "Telegram",
            "whatsapp_qr": "WhatsApp QR",
            "pilot_24": "Pilot connection: $24",
            "additional_24": "Additional connections: $24 ea.",
            "twilio": "Twilio - SMS & Calls",
            "webchat": "Webchat"
          }
        },
        "team": {
          "title": "Team agents",
          "desc": "Manage the people who have access to your organization dashboard.",
          "add": "Add Agent",
          "empty": "No agents found",
          "emptyDesc": "You haven't added any team agents yet. Add agents to help you manage your organization."
        },
        "agents": {
          "form": {
            "add_title": "Add agent",
            "add_desc": "Add team agent and manage Workspace access",
            "first_name": "First Name",
            "last_name": "Last Name",
            "email": "Email",
            "role": "Role",
            "select_role": "Select a role",
            "whatsapp": "WhatsApp number",
            "language": "Language",
            "select_language": "Select language",
            "tfa_title": "2-Factor authentication",
            "tfa_label": "Require 2-Factor Authentication",
            "tfa_desc": "This will force the agent to enable 2-Factor Authentication on their next login",
            "added": "Agent Added",
            "added_desc": "Team agent has been added successfully",
            "save_error": "Failed to add agent",
            "required_fields": "Name, email, and password are required",
            "premium": {
              "title": "Premium Support",
              "label": "Can access Premium Support",
              "modal_title": "Grant Premium Support Access",
              "modal_desc": "Premium Support (Live Chat): Connect directly with our support team during business hours, 12:00 - 20:00 UTC",
              "cost_today": "Cost today",
              "monthly_cost": "then $15 per month",
              "terms": "I understand that adding extra agent access to the Premium Support Access (Live Chat) is a paid service",
              "enter_code": "Enter this code",
              "to_continue": "in the field below to continue",
              "code_placeholder": "Enter code here",
              "subscribed_count": "You have {{count}} agent(s) subscribed to Premium Support",
              "plan_details": "Your current plan includes Premium Support access for 2 agent(s). Additional agent access is available for just $15/month each",
              "email": "Email to access premium support",
              "phone": "Phone number to access premium support",
              "whatsapp": "WhatsApp to access premium support"
            }
          },
          "roles": {
            "super_user": "Super User",
            "co_owner": "Organization co-owner"
          }
        },
        "roles": {
          "manage": "Manage Roles & Permissions and assign them to specific agents.",
          "add": "Add Role",
          "systemRole": "System Role",
          "empty": "There is nothing here.",
          "emptyActive": "All of your active roles will appear here.",
          "emptyArchived": "All of your archived roles will appear here.",
          "table": {
            "name": "Name",
            "description": "Description",
            "actions": "Actions"
          },
          "form": {
            "edit_title": "Edit role",
            "add_title": "Add role",
            "name": "Name",
            "select_icon": "Select Icon",
            "select_icon_placeholder": "Select an icon",
            "description": "Description",
            "permissions": "Permissions"
          },
          "categories": {
            "team": "Team",
            "roles": "Roles & Permissions",
            "workspaces": "Workspaces",
            "settings": "Settings",
            "legal": "Legal"
          },
          "permissions": {
            "team": {
              "add": "Add Agent",
              "add_desc": "Can add an Agent",
              "edit": "Edit Agent",
              "edit_desc": "Can edit Agent",
              "delete": "Delete Agents",
              "delete_desc": "Allow member to delete other agents"
            },
            "roles": {
              "add": "Add Role",
              "add_desc": "Can add role",
              "edit": "Edit Role",
              "edit_desc": "Edit a role",
              "delete": "Delete Role",
              "delete_desc": "Can delete role"
            },
            "workspaces": {
              "add": "Add Workspace",
              "add_desc": "Can create a Workspace",
              "edit": "Edit Workspace",
              "edit_desc": "Can edit a Workspace",
              "delete": "Delete Workspace",
              "delete_desc": "Can delete a workspace"
            },
            "settings": {
              "billing": "Billing",
              "billing_desc": "Grant agent access and authorization to modify billing information",
              "mobile": "Mobile Applications",
              "mobile_desc": "Manage Mobile Applications",
              "audit": "Audit logs",
              "audit_desc": "Allow to access Audit logs",
              "help": "Help",
              "help_desc": "Allow to access the help section",
              "agency": "Organization settings",
              "agency_desc": "Allow access to the Organization Settings"
            },
            "legal": {
              "view": "View legal",
              "view_desc": "Allow access to legal option",
              "view_doc": "View Document",
              "view_doc_desc": "View legal document",
              "create": "Create Legal Document",
              "create_desc": "Allow Agent to create new legal documents",
              "edit": "Edit Legal Document",
              "edit_desc": "Allow Agent to edit legal document"
            }
          }
        },
        "billing": {
          "title": "Billing Management",
          "desc": "Manage your organization's billing, subscriptions, and usage.",
          "plans": {
            "title": "Billing Plans",
            "desc": "Choose the best plan for your organization.",
            "current_plan": "Current Plan",
            "next_payment": "Next Payment: {{date}}",
            "cancel_subscription": "Cancel Subscription",
            "heads_up": "Heads up!",
            "downgrade_warning_title": "",
            "downgrade_warning_desc": "We know it's a bit annoying, but our plans don't support downgrades. 🙃 If you really need to downgrade, you'll have to create a brand-new account and start from scratch, yep, content and all. We're truly sorry for the hassle, we wish it were easier too! 💙",
            "types": {
              "free": {
                "name": "Free",
                "limit": "Limit of 50 contacts.",
                "feature": "Completely FREE"
              },
              "premium": {
                "name": "Premium",
                "limit": "Limit of 1000 contacts.",
                "feature": "All features from Premium Workspaces."
              },
              "ignite": {
                "name": "Ignite",
                "limit": "Limit of 3000 contacts.",
                "feature": "All features from Premium Workspaces."
              },
              "enterprise": {
                "name": "Enterprise",
                "limit": "A special plan designed just for resellers!",
                "feature": "All features from Premium Workspaces."
              }
            },
            "cancel_modal": {
              "title": "Cancel Subscription",
              "understand": "Please read and understand the following before cancelling:",
              "check1": "I understand that I will lose access to premium features at the end of my billing cycle.",
              "check2": "I understand that any data exceeding the free tier limits may be restricted.",
              "check3": "I understand this action cannot be easily undone without resubscribing.",
              "renew_warning": "Your subscription will remain active until {{date}}.",
              "enter_code": "Enter code {{code}} to confirm cancellation:",
              "code_placeholder": "Enter confirmation code"
            }
          },
          "manage": {
            "title": "Manage Payment Methods",
            "desc": "Update your credit cards and billing information.",
            "modalTitle": "Manage Billing",
            "emailPrompt": "Enter your email to manage billing securely via our portal:"
          },
          "coupons": {
            "title": "Coupons & Discounts",
            "addDesc": "Apply a coupon code to your subscription.",
            "appliedList": "Applied Coupons",
            "add": "Add Coupon",
            "placeholder": "Enter coupon code",
            "error": "Invalid coupon code.",
            "applied": "Coupon Applied",
            "appliedDesc": "Coupon {{code}} has been successfully applied.",
            "alreadyApplied": "Already Applied",
            "alreadyAppliedDesc": "This coupon code is already active on your account.",
            "removed": "Coupon Removed",
            "removedDesc": "Coupon {{code}} has been removed."
          },
          "usage": {
            "title": "Current Usage",
            "desc": "View your current billing cycle usage and overages.",
            "show": "View Details",
            "empty": "No usage data available for this period.",
            "amount": "Amount",
            "subtotal": "Subtotal",
            "discount": "Discount",
            "total": "Total Amount Due"
          }
        },
        "legal": {
          "title": "Legal Documents",
          "desc": "Manage your organization's terms of service, privacy policies, and other legal agreements.",
          "tabs": {
            "active": "Active",
            "history": "History",
            "accepted": "Accepted"
          },
          "table": {
            "checkbox": "Checkbox",
            "name": "Document Name",
            "active_date": "Active Date",
            "inactive_date": "Inactive Date",
            "accepted_at": "Accepted At",
            "action": "Actions"
          },
          "actions": {
            "view": "View",
            "edit": "Edit",
            "add": "Add New",
            "archive": "Archive"
          },
          "info": {
            "accepted_desc": "List of users who have accepted the active legal documents.",
            "accepted_list": "Historical record of document acceptances."
          },
          "modals": {
            "edit": {
              "title": "Legal Document",
              "desc": "Create or edit a legal document and its presentation to users.",
              "doc_name": "Document Name",
              "link_text": "Link Text (shown to user)",
              "checkbox_text_label": "Checkbox Text",
              "doc_link_btn": "Insert Document Link",
              "preview": "Preview",
              "file_upload_btn": "Upload PDF Document",
              "file_upload_warning": "Max file size: 5MB. PDF only."
            },
            "archive": {
              "title": "Archive Document?",
              "desc": "Are you sure you want to archive this document? It will be moved to history and users will no longer need to accept it."
            }
          }
        }
      },
      "notifications": {
        "title": "Notifications",
        "empty": "Currently, there are no notifications to present.",
        "sound": "Sound notifications"
      }
    }
  }
};

// Deep merge helper
function deepMerge(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      typeof override[key] === 'object' &&
      override[key] !== null &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// English: merge hardcoded base with JSON file
resources.en.translation = deepMerge(resources.en.translation, enJson) as typeof resources.en.translation;

// All languages: merge English (full) with their JSON, so missing keys fall back to English
const enFull = resources.en.translation;
(resources as any).pt = { translation: deepMerge(enFull, ptJson) };
(resources as any).es = { translation: deepMerge(enFull, esJson) };
(resources as any).ar = { translation: deepMerge(enFull, arJson) };
(resources as any).fr = { translation: deepMerge(enFull, frJson) };
(resources as any).de = { translation: deepMerge(enFull, deJson) };
(resources as any).hi = { translation: deepMerge(enFull, hiJson) };
(resources as any).ur = { translation: deepMerge(enFull, urJson) };
(resources as any).zh = { translation: deepMerge(enFull, zhJson) };
(resources as any).ja = { translation: deepMerge(enFull, jaJson) };
(resources as any).ru = { translation: deepMerge(enFull, ruJson) };
(resources as any).tr = { translation: deepMerge(enFull, trJson) };
(resources as any).it = { translation: deepMerge(enFull, itJson) };
(resources as any).id = { translation: deepMerge(enFull, idJson) };
(resources as any).vi = { translation: deepMerge(enFull, viJson) };
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
