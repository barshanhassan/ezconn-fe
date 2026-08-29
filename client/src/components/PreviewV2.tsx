import React, { useRef, useEffect } from 'react';
import { ChevronLeft, Wifi, Battery, ArrowLeft, Square, Circle, MoreVertical, FileText, Play, Smile, Camera } from 'react-feather';
import { Forward, Briefcase, Shapes, MapPin, Mail, Globe, MessageSquare } from 'lucide-react';
import { MdMic, MdAttachFile, MdSend, MdDoneAll } from 'react-icons/md';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

type Mode = "chat" | "profile";

interface PreviewV2Props {
  mode?: Mode;

  // Optional Template content:
  showPlaceholderMessageInTemplate?: boolean;
  showTopBar?: boolean;
  showBottomBar?: boolean;

  // Optional Message Related
  headerText?: string;
  bodyText?: string;
  placeholderText?: string;
  footerText?: string;
  selectedMediaFile?: File | string | null;
  templateButtons?: Array<any>;
  variableSamples?: Record<string, string>;

  // Carousel template preview — mirrors replyagent's TemplatePreview.vue
  // Branch B: the bubble body renders as the normal message, then the ACTIVE
  // card only renders below it with chevron navigation between cards.
  carouselCards?: Array<{
    mediaFormat?: string;
    media?: { file_url?: string } | null;
    body?: string;
    buttons?: Array<any>;
  }>;
  activeCardIndex?: number;
  onCardChange?: (index: number) => void;

  // Optional Command related
  commands?: { commandText: string; commandDescription: string; }[];

  // Optional Ice Breaker content
  icebreakers?: string[];

  // Optional profile content
  profilePhoneNumber?: string;
  profileDescription?: string;
  profileCategory?: string;
  profileAddress?: string;
  profileEmail?: string;
  profileWebsite?: string;
  profileAbout?: string;

  // Optional Universal stuff
  showMobile?: boolean;
  profileName?: string;
  profileSubText?: string;
  profilePfpUrl?: string;
}

const PreviewV2: React.FC<PreviewV2Props> = ({
  mode = "chat",
  headerText = "",
  bodyText = "",
  placeholderText,
  footerText = "",
  selectedMediaFile = "",
  templateButtons = [],
  icebreakers = [],
  commands = [],
  variableSamples = {},
  carouselCards = [],
  activeCardIndex = 0,
  onCardChange,
  showPlaceholderMessageInTemplate = true,
  showMobile = true,
  profileName,
  profileSubText,
  profilePfpUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23DFE5E7'/%3E%3Cg fill='white'%3E%3Ccircle cx='50' cy='40' r='15'/%3E%3Cpath d='M50,60 C30,60 20,80 20,100 L80,100 C80,80 70,60 50,60 Z'/%3E%3C/g%3E%3C/svg%3E",
  profilePhoneNumber = "",
  profileDescription = "",
  profileCategory = "",
  profileAddress = "",
  profileEmail = "",
  profileWebsite = "",
  profileAbout = "",
  showTopBar = true,
  showBottomBar = true,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholderText = placeholderText ?? t("preview_v2.placeholder_text_default");
  const resolvedProfileName = profileName ?? t("preview_v2.profile_name_default");
  const resolvedProfileSubText = profileSubText ?? t("preview_v2.profile_sub_text_default");
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const baseWidth = 450;
  const baseHeight = 900;

  const splitByNewlines = (text: string, startKey: number) => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Check if line starts with "- " for bullet points
      if (line.trim().startsWith('- ')) {
        const bulletText = line.replace(/^\s*-\s/, '');
        result.push(
          <span key={startKey + index * 2}>
            <span className="inline-block mr-[4px]">•</span>
            {bulletText}
          </span>
        );
      } else {
        result.push(<span key={startKey + index * 2}>{line}</span>);
      }

      if (index < lines.length - 1) {
        result.push(<br key={startKey + index * 2 + 1} />);
      }
    });

    return result;
  };

  // Format text with variables - handles formatting that wraps variables like *{{1}}*
  const formatTextWithVariables = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Match formatting patterns that may contain variables: *...*,  _..._,  ~...~
    const regex = /(\*[^*]*\*|_[^_]*_|~[^~]*~)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.substring(currentIndex, match.index);
        // Split by variables and format
        beforeText.split(/(\{\{[^}]+\}\})/).forEach((part) => {
          if (part.match(/\{\{[^}]+\}\}/)) {
            const variableKey = part.match(/\{\{([^}]+)\}\}/)?.[1] || "";
            const value = variableSamples[variableKey];
            parts.push(
              <span key={key++} className={value ? "text-[#111B21]" : "text-[#0084FF] font-medium"}>
                {value || part}
              </span>
            );
          } else if (part) {
            parts.push(...splitByNewlines(part, key));
            key += part.split('\n').length;
          }
        });
      }

      const matchedText = match[0];
      const innerText = matchedText.substring(1, matchedText.length - 1);
      const formatChar = matchedText[0];

      // Process inner text for variables
      const innerContent = innerText.split(/(\{\{[^}]+\}\})/).map((part, idx) => {
        if (part.match(/\{\{[^}]+\}\}/)) {
          const variableKey = part.match(/\{\{([^}]+)\}\}/)?.[1] || "";
          const value = variableSamples[variableKey];
          return (
            <span key={idx} className={value ? "text-[#111B21]" : "text-[#0084FF] font-medium"}>
              {value || part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      });

      // Apply formatting based on WhatsApp syntax
      if (formatChar === '*') {
        parts.push(<strong key={key++}>{innerContent}</strong>);
      } else if (formatChar === '_') {
        parts.push(<em key={key++}>{innerContent}</em>);
      } else if (formatChar === '~') {
        parts.push(<s key={key++}>{innerContent}</s>);
      }

      currentIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      remainingText.split(/(\{\{[^}]+\}\})/).forEach((part) => {
        if (part.match(/\{\{[^}]+\}\}/)) {
          const variableKey = part.match(/\{\{([^}]+)\}\}/)?.[1] || "";
          const value = variableSamples[variableKey];
          parts.push(
            <span key={key++} className={value ? "text-[#111B21]" : "text-[#0084FF] font-medium"}>
              {value || part}
            </span>
          );
        } else if (part) {
          parts.push(...splitByNewlines(part, key));
          key += part.split('\n').length;
        }
      });
    }

    return parts.length > 0 ? parts : text;
  };

  // Get button display text with emoji mapping
  const getButtonDisplayText = (button: any): string => {
    const emojiMap: Record<string, string> = {
      "copy-offer": "💻",
      "complete-flow": "📋",
      "call-phone": "📞",
      "call-whatsapp": "📞",
      "visit-website": "↗️",
      "quick-reply": ""
    };

    let emoji = emojiMap[button.type] || "";

    if (button.type === "complete-flow") {
      const flowEmojiMap: Record<string, string> = {
        "default": "📋",
        "document": "📄",
        "promotion": "🎁",
        "review": "⭐"
      };
      const flowEmoji = flowEmojiMap[button.flowButton] || "📋";
      emoji = `📋 ${flowEmoji}`;
    }

    const text = button.buttonText || t("preview_v2.button_default");
    return emoji ? `${emoji} ${text}` : text;
  };

  const hasContent = headerText || bodyText || footerText || templateButtons.length > 0 || selectedMediaFile;

  useEffect(() => {
    const container = containerRef.current;
    const scaleWrapper = scaleWrapperRef.current;

    if (!container || !scaleWrapper) return;

    let animationFrameId: number;

    const resizeObserver = new ResizeObserver(entries => {
      cancelAnimationFrame(animationFrameId);

      animationFrameId = requestAnimationFrame(() => {
        try {
          for (let entry of entries) {
            const { width, height } = entry.contentRect;

            const scaleX = width / baseWidth;
            const scaleY = height / baseHeight;
            const scale = Math.min(scaleX, scaleY);

            scaleWrapper.style.transform = `scale(${scale})`;
          }
        } catch (error) {
          console.error('Error in ResizeObserver:', error);
        }
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [bodyText, headerText, footerText, selectedMediaFile, templateButtons]);

  const mobilePadding = 30;

  const whiteContentDiv = (
    <div className='flex flex-col flex-grow rounded-[14px] -m-px'
      style={{
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        width: `${baseWidth - (showMobile ? mobilePadding * 2 : 0)}px`
      }}
    >
      {showTopBar && (
        <div className='w-full max-h-[35px] h-full bg-gray-900 rounded-t-[14px] flex items-center justify-between px-[16px] text-white'>
          <span className="text-[14.5px] font-semibold">9:41</span>
          <div className="flex items-center space-x-[4px]">
            <Wifi size={17} />
            <Battery size={17} fill="white" />
          </div>
        </div>
      )}

      {mode === 'chat' && (
        <>
          <div className={`w-full max-h-[72px] h-full bg-white -mt-px flex items-center justify-between px-[16px] ${!showTopBar ? 'rounded-t-[14px]' : ''}`} style={{ boxShadow: 'inset 0 -3px 0 0 #e6e6e6' }}>
            <div className="flex items-center">
              <ArrowLeft size={24} color="#111B21" />
              <img src={profilePfpUrl} className="ml-[10px] mr-[9px] w-[40px] h-[40px] bg-gray-300 rounded-full object-cover" alt={t("preview_v2.profile_picture_alt")} />
              <div className="flex flex-col">
                <span className="text-[19px] font-semibold truncate max-w-[230px] text-[#111B21]">{resolvedProfileName}</span>
                <span className="text-[15px] mt-[-3.5px] truncate max-w-[230px] text-[#111B21]">{resolvedProfileSubText}</span>
              </div>
            </div>
            <MoreVertical size={24} />
          </div>
          <div
            ref={chatAreaRef}
            className={`w-full h-full bg-[#ECE5DD] -mt-px px-[17px] overflow-y-auto overflow-x-hidden flex flex-col scrollbar-hide ${!showBottomBar ? 'rounded-b-[14px]' : ''}`}
          >
            {showPlaceholderMessageInTemplate && (
              <>
                <div className="flex-1 min-h-0 pb-[16px]"></div>
                <div className="relative flex justify-start flex-shrink-0">
                  <div className="absolute w-[25px] h-[30px] left-[-10px] top-[0px] bg-white" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                  <div className="z-10 bg-white rounded-[16px] px-[12px] py-[8px] max-w-[300px] shadow-sm overflow-hidden">
                    {selectedMediaFile && (
                      <div className="mb-[8px] mt-[4px]">
                        {typeof selectedMediaFile === 'string' ? (
                          <img
                            src={selectedMediaFile}
                            alt={t("preview_v2.media_preview_alt")}
                            className="max-w-full h-auto rounded max-h-[192px] object-cover"
                          />
                        ) : selectedMediaFile.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(selectedMediaFile)}
                            alt={t("preview_v2.media_preview_alt")}
                            className="max-w-full h-auto rounded max-h-[192px] object-cover"
                          />
                        ) : selectedMediaFile.type.startsWith('video/') ? (
                          <video
                            src={URL.createObjectURL(selectedMediaFile)}
                            className="max-w-full h-auto rounded max-h-[192px] object-cover"
                            controls
                          />
                        ) : (
                          <div className="flex items-center gap-[8px] p-[8px] bg-[#F0F0F0] rounded">
                            <FileText size={20} className="text-[#666666]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-[#111B21] truncate">{selectedMediaFile.name}</p>
                              <p className="text-[12px] text-[#666666]">({(selectedMediaFile.size / 1024).toFixed(1)}KB)</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className='flex flex-col space-y-[6px]'>
                      {headerText && (
                        <div>
                          <p className="text-[19px] font-semibold text-[#111B21] leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                            {headerText.split(/(\{\{[^}]+\}\})/).map((part, idx) => {
                              const variableMatch = part.match(/\{\{([^}]+)\}\}/);
                              if (variableMatch) {
                                const variableKey = variableMatch[1];
                                const value = variableSamples[variableKey];
                                return (
                                  <span key={idx} className={value ? "text-[#111B21]" : "text-[#0084FF] font-medium"}>
                                    {value || part}
                                  </span>
                                );
                              }
                              return <span key={idx}>{part}</span>;
                            })}
                          </p>
                        </div>
                      )}

                      {bodyText && (
                        <p className="leading-[25px] text-[18px] text-[#111B21] leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                          {formatTextWithVariables(bodyText)}
                        </p>
                      )}

                      {footerText && (
                        <p className="text-[16.5px] text-[#666666] leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                          {footerText}
                        </p>
                      )}

                    </div>

                    {!hasContent && (
                      <p className="text-[17.5px] text-[#999999] italic">
                        {resolvedPlaceholderText}
                      </p>
                    )}

                    <div className='flex w-full justify-end gap-[2px]'>
                      <p className="text-[14px] text-[#999999] font-medium">9:41 AM</p>
                      <MdDoneAll size={22} fill='#999999' />
                    </div>

                    {templateButtons.length > 0 && (
                      <div className="mt-[2px] space-y-[4px]">
                        {templateButtons.slice(0, 3).map((button) => (
                          <>
                            <div className="w-[calc(100% + 24px)] -mx-[12px]" style={{ borderTopWidth: "2px", borderTopColor: "#e7e7e7ff" }}></div>
                            <div key={button.id} className="px-[12px] py-[8px] text-center">
                              <p className="text-[18px] text-[#0064FF] font-normal break-words">
                                {getButtonDisplayText(button)}
                              </p>
                            </div>
                          </>
                        ))}
                        {templateButtons.length > 3 && (
                          <>
                            <div className="w-[calc(100% + 24px)] -mx-[12px]" style={{ borderTopWidth: "2px", borderTopColor: "#e7e7e7ff" }}></div>
                            <div className="px-[12px] py-[8px] text-center">
                              <Play size={14} className="text-[#0064FF]" />
                              <p className="text-[18px] text-[#0064FF] font-normal">{t("preview_v2.see_all_options")}</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {carouselCards.length > 0 && (() => {
                  const clampedIndex = Math.min(Math.max(activeCardIndex, 0), carouselCards.length - 1);
                  const card = carouselCards[clampedIndex];
                  const cardMediaUrl = card?.media?.file_url ?? "";
                  return (
                    <div className="relative flex justify-start flex-shrink-0 mt-[8px]">
                      <div className="z-10 bg-white rounded-[16px] overflow-hidden max-w-[260px] shadow-sm">
                        {cardMediaUrl && (
                          <div className="bg-black/5">
                            {card?.mediaFormat === "VIDEO" ? (
                              <video src={cardMediaUrl} className="w-full h-[140px] object-cover" controls />
                            ) : (
                              <img src={cardMediaUrl} alt={t("preview_v2.card_alt")} className="w-full h-[140px] object-cover" />
                            )}
                          </div>
                        )}
                        <div className="px-[12px] py-[8px]">
                          <p className="text-[16px] text-[#111B21] leading-relaxed whitespace-pre-wrap break-words">
                            {card?.body || ""}
                          </p>
                        </div>
                        {(card?.buttons ?? []).length > 0 && (
                          <div className="space-y-0">
                            {(card?.buttons ?? []).map((button: any, i: number) => (
                              <div key={i}>
                                <div className="w-full" style={{ borderTopWidth: "2px", borderTopColor: "#e7e7e7ff" }} />
                                <div className="px-[12px] py-[8px] text-center">
                                  <p className="text-[15px] text-[#0064FF] font-normal break-words">
                                    {getButtonDisplayText(button)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Chevrons — jump between cards, mirroring replyagent's
                          TemplatePreview.vue carousel navigation. */}
                      {carouselCards.length > 1 && onCardChange && (
                        <>
                          {clampedIndex > 0 && (
                            <button
                              type="button"
                              onClick={() => onCardChange(clampedIndex - 1)}
                              className="absolute -left-[10px] top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-white shadow flex items-center justify-center text-[#111B21] text-[13px]"
                            >
                              ‹
                            </button>
                          )}
                          {clampedIndex < carouselCards.length - 1 && (
                            <button
                              type="button"
                              onClick={() => onCardChange(clampedIndex + 1)}
                              className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-white shadow flex items-center justify-center text-[#111B21] text-[13px]"
                            >
                              ›
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="bg-[#ECE5DD] -mt-[2px] w-full flex items-end pt-[12px] pb-[10px] px-[8px]">
            <div className="flex-1 bg-white w-full rounded-[24px] flex flex-col items-center">
              <div className="w-full">
                {icebreakers.length > 0 && icebreakers.some(icebreaker => icebreaker.trim() !== "") && (
                  <div className="pt-[12px] pb-[4px] pl-[12px] pr-[16px] max-h-[500px] overflow-y-auto"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}>
                    {icebreakers.filter(icebreaker => icebreaker.trim() !== "").map((icebreaker, index) => (
                      <div key={index} className='flex justify-between items-center '>
                        <div className="p-[8px] text-gray-700 text-[18px] break-all">
                          {icebreaker}
                        </div>
                        <div className='h-[22px] w-[22px]'>
                          <MdSend size={22} fill='#36AD60' />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {commands.length > 0 && commands.some(commands => commands.commandText.trim() !== "") && (
                  <div className="pt-[10px] pb-[4px] pl-[5px] pr-[16px] max-h-[500px] overflow-y-auto"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}>
                    {commands.map((command, index) => (
                      <>
                        {command.commandText.trim() !== "" && (
                          <div key={index} className="flex items-start p-[8px]">
                            <img src={profilePfpUrl} className="w-[28px] mr-[10px] h-[28px] bg-gray-300 rounded-full object-cover" alt={t("preview_v2.profile_picture_alt")} />
                            <div className="flex flex-col">
                              <span className="text-[16px] font-semibold text-[#111B21] break-all">{command.commandText}</span>
                              <span className="text-[14.5px] text-[#666666] break-all">{command.commandDescription}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-full min-h-[50px] flex items-center px-[15px]">
                <Smile size={25} className="text-gray-500" />
                <input
                  type="text"
                  placeholder={commands.length > 0 && commands.some(commands => commands.commandText.trim() !== "") ? "\\" : t("preview_v2.message_placeholder")}
                  className={`flex-1 bg-transparent outline-none px-[10px] placeholder:text-[19px] ${commands.length > 0 ? 'placeholder:text-[#111B21]' : 'placeholder:text-gray-500'}`}
                  disabled
                />
                <MdAttachFile size={25} className="text-gray-500" />
                <Camera size={24} className="text-gray-500 ml-[10px]" />
              </div>
            </div>
            <button className="flex items-center justify-center h-[50px] w-[50px] ml-[8px] bg-[#36AD60] rounded-full">
              <MdMic color='white' size={28} />
            </button>
          </div>
        </>
      )}

      {mode === 'profile' && (
        <>
          <div className={`pb-[30px] w-full h-full bg-white -mt-px px-[16px] overflow-y-auto overflow-x-hidden flex flex-col scrollbar-hide ${!showBottomBar ? 'rounded-b-[14px]' : ''}`}>
            <div className={`pt-[24px] w-full h-fit bg-white -mt-px flex items-start justify-between ${!showTopBar ? 'rounded-t-[14px]' : ''}`}>
              <ArrowLeft size={24} />
              <img src={profilePfpUrl} className="w-[130px] h-[130px] rounded-full object-cover" alt={t("preview_v2.profile_alt")} />
              <MoreVertical size={24} />
            </div>

            {/* Profile Picture, Name, ~Phone Number, Share Button */}
            <div className="flex flex-col items-center text-center pt-[10px] mb-[2px]">
              <h2 className="text-[24px] font-semibold max-w-[300px] leading-7 break-all text-[#111B21]">{resolvedProfileName}</h2>
              {profilePhoneNumber && <p className="mt-[4px] text-[20px] text-gray-500 max-w-[300px] break-all">{profilePhoneNumber}</p>}
              <div className="mt-[24px] py-[6px] px-[44px] flex flex-col items-center justify-center border rounded-[10px] shadow-xs border-[#0000001A]">
                <Forward size={24} color="#36AD60" />
                <h3 className='font-medium text-[#111B21]'>{t("preview_v2.share")}</h3>
              </div>
            </div>

            {/* Description, Category, Address, Email, Website*/}
            {(profileDescription || profileCategory || profileAddress || profileEmail || profileWebsite) && (
              <>
                <div
                  className='my-[22px] border-t-[2px] border-[#e7e7e7ff]'
                  style={{
                    width: "calc(100% + 32px)",
                    marginLeft: "-16px"
                  }}
                />
                <div
                  className="flex flex-col"
                  style={{ gap: "16px" }}
                >
                  {profileDescription &&
                    <div style={{ gap: "18px" }} className="flex items-start">
                      <Briefcase size={24} className="mt-[4px] flex-shrink-0 text-gray-500" />
                      <p className="text-gray-700 text-[20px] font-medium break-all">{profileDescription}</p>
                    </div>
                  }
                  {profileCategory &&
                    <div style={{ gap: "18px" }} className="flex items-start">
                      <Shapes size={24} className="mt-[4px] flex-shrink-0 text-gray-500" />
                      <p className="text-gray-500 text-[20px] font-medium break-all">{profileCategory}</p>
                    </div>
                  }
                  {profileAddress &&
                    <div style={{ gap: "18px" }} className="flex items-start">
                      <MapPin size={24} className="mt-[4px] flex-shrink-0 text-gray-500" />
                      <p className="text-gray-500 text-[20px] font-medium break-all">{profileAddress}</p>
                    </div>
                  }
                  {profileEmail &&
                    <div style={{ gap: "18px" }} className="flex items-start">
                      <Mail size={24} className="mt-[4px] flex-shrink-0 text-gray-500" />
                      <p className="text-blue-500 text-[20px] font-medium break-all">{profileEmail}</p>
                    </div>
                  }
                  {profileWebsite &&
                    <div style={{ gap: "18px" }} className="flex items-start">
                      <Globe size={24} className="mt-[4px] flex-shrink-0 text-gray-500" />
                      <p className="text-blue-500 text-[20px] font-medium break-all">{profileWebsite}</p>
                    </div>
                  }
                </div>
              </>
            )}

            {/* About and phonenumber */}
            {(profileAbout || profilePhoneNumber) && (
              <>
                <div
                  className='my-[22px] border-t-[2px] border-[#e7e7e7ff]'
                  style={{
                    width: "calc(100% + 32px)",
                    marginLeft: "-16px"
                  }}
                />
                <h3 className="text-gray-500 font-semibold mb-[4px]">
                  {profileAbout ? t("preview_v2.about") : ""}
                  {profileAbout && profilePhoneNumber ? t("preview_v2.and_phone_number") : ""}
                  {profilePhoneNumber && !profileAbout ? t("preview_v2.phone_number") : ""}
                </h3>
                <div>
                  {profileAbout && (
                    <div className="mt-[4px] mb-[20px]">
                      <p className="text-gray-900 break-all text-[20px] font-medium">{profileAbout}</p>
                      {/* Date placeholder */}
                      <p className="mt-[2px] text-gray-500 font-medium">{format(Date.now(), 'MMM dd, yyyy')}</p>
                    </div>
                  )}
                  {profilePhoneNumber && (
                    <div className="mt-[4px] flex items-center justify-between">
                      <p className="text-gray-900 break-all text-[20px] font-medium">{profilePhoneNumber}</p>
                      <MessageSquare size={28} color="#36AD60" />
                    </div>
                  )}
                </div>
              </>
            )}

            <div
              className='my-[22px] border-t-[2px] border-[#e7e7e7ff]'
              style={{
                width: "calc(100% + 32px)",
                marginLeft: "-16px"
              }}
            />
          </div>
        </>
      )}

      {showBottomBar && (
        <div className='z-20 w-full max-h-[55px] h-full bg-gray-900 rounded-b-[14px] -mt-px flex items-center justify-around text-white'>
          <ChevronLeft size={28} />
          <Circle size={20} />
          <Square size={20} />
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className='w-full h-full flex items-center justify-center'>
      <div
        ref={scaleWrapperRef}
        style={{ width: `${baseWidth}px`, height: `${baseHeight}px`, transformOrigin: 'center center' }}
      >
        <div className='flex p-[0px] h-full w-full'>
          {showMobile ? (
            <div className={`flex flex-grow bg-black rounded-[24px]`} style={{ padding: `${mobilePadding}px` }}>
              {whiteContentDiv}
            </div>
          ) : (
            whiteContentDiv
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewV2;

