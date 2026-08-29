import React from "react";
import { Send } from "react-feather";
import { useTranslation } from "react-i18next";

interface ProfilePreviewProps {
  profilePhotoUrl?: string | null;
  displayName?: string;
  about?: string;
  category?: string;
  email?: string;
  website?: string;

  // Styling props for outer container
  containerClassName?: string;
  phoneClassName?: string;
  chatAreaClassName?: string;
  messageBoxClassName?: string;
}

export default function ProfilePreview({
  profilePhotoUrl = null,
  displayName,
  about,
  category,
  email = "business@example.com",
  website = "https://www.yourbusiness.com",
  containerClassName = "flex-1 flex items-center justify-center min-h-0",
  phoneClassName = "h-full aspect-[9/18] bg-black rounded-3xl p-3 shadow-lg flex flex-col overflow-hidden",
  chatAreaClassName = "flex-1 bg-[#ECE5DD] px-4 pt-4 pb-4 overflow-y-auto overflow-x-hidden flex flex-col space-y-3 scrollbar-hide",
  messageBoxClassName = "bg-white rounded-2xl rounded-bl-none px-3 py-2 max-w-xs shadow-sm overflow-hidden",
}: ProfilePreviewProps) {
  const { t } = useTranslation();
  const displayNameValue = displayName ?? t("profile_preview.default_display_name");
  const aboutValue = about ?? t("profile_preview.default_about");
  const categoryValue = category ?? t("profile_preview.default_category");
  return (
    <div className={containerClassName}>
      {/* Phone mockup */}
      <div className={phoneClassName}>
        {/* Phone header - WhatsApp green */}
        <div className="bg-[#075E54] rounded-t-2xl px-4 py-2 flex items-center justify-between" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#25D366] rounded-full"></div>
            <div>
              <p className="text-xs font-semibold text-white">WhatsApp</p>
              <p className="text-xs text-[#DCF8C6]">{t("profile_preview.online")}</p>
            </div>
          </div>
        </div>

        {/* Chat area - WhatsApp light background */}
        <div
          className={chatAreaClassName}
          style={{
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Spacer to push message to bottom */}
          <div className="flex-1 min-h-0"></div>

          {/* Profile preview content */}
          <div className="flex justify-start flex-shrink-0">
            <div className={messageBoxClassName} style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              {/* Profile Photo */}
              {profilePhotoUrl ? (
                <div className="flex justify-center mb-3">
                  <img src={profilePhotoUrl} alt={t("profile_preview.profile_photo_alt")} className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-md" />
                </div>
              ) : (
                <div className="flex justify-center mb-3">
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs border-2 border-white shadow-md">
                    {t("profile_preview.no_photo")}
                  </div>
                </div>
              )}

              {/* Display Name */}
              <div className="text-center mb-3">
                <p className="text-lg font-bold text-[#111B21]">{displayNameValue}</p>
              </div>

              {/* About */}
              {aboutValue && (
                <div className="mb-3">
                  <p className="text-xs text-[#666666] font-medium">{t("profile_preview.about_label")}</p>
                  <p className="text-sm text-[#111B21] whitespace-pre-wrap">{aboutValue}</p>
                </div>
              )}

              {/* Business Information */}
              <div className="space-y-2">
                {categoryValue && (
                  <div>
                    <p className="text-xs text-[#666666] font-medium">{t("profile_preview.category_label")}</p>
                    <p className="text-sm text-[#111B21]">{categoryValue}</p>
                  </div>
                )}
                {email && (
                  <div>
                    <p className="text-xs text-[#666666] font-medium">{t("profile_preview.email_label")}</p>
                    <p className="text-sm text-[#0084FF]">{email}</p>
                  </div>
                )}
                {website && (
                  <div>
                    <p className="text-xs text-[#666666] font-medium">{t("profile_preview.website_label")}</p>
                    <p className="text-sm text-[#0084FF]">{website}</p>
                  </div>
                )}
              </div>

              <p className="text-[0.7rem] text-[#999999] text-right mt-3">9:41 AM</p>
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="bg-[#E8E8E8] rounded-b-2xl px-4 py-2 flex items-center gap-2" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          <div className="h-8 flex flex-1 bg-white rounded-full px-3 py-1 items-center border border-[#E5E5EA]">
            <p className="text-sm text-[#999999]">{t("profile_preview.type_a_message")}</p>
          </div>
          <button className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center hover:bg-[#20BA5A] transition-colors">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
