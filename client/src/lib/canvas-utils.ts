import { PropertyFormData } from "@shared/schema";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

const bankLogos = {
  sovkombank: "СОВКОМБАНК",
  sberbank: "СБЕРБАНК", 
  vtb: "ВТБ",
  alfabank: "АЛЬФА-БАНК",
  tinkoff: "ТИНЬКОФФ",
};

const propertyTypeLabels = {
  "1k": "1К КВАРТИРА",
  "2k": "2К КВАРТИРА",
  "3k": "3К КВАРТИРА",
  studio: "СТУДИЯ",
};

const mortgageTypeLabels = {
  basic: "БАЗОВАЯ ИПОТЕКА",
  family: "СЕМЕЙНАЯ ИПОТЕКА",
  it: "IT-ИПОТЕКА",
};

// Generate geometric pattern background
function generateGeometricBackground(ctx: CanvasRenderingContext2D, type: string, color: string) {
  const width = 1080;
  const height = 1920;
  
  // Clear with gradient background first
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, adjustBrightness(color, -20));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  ctx.save();
  
  if (type === 'circles') {
    // Generate random circles
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = 50 + Math.random() * 150;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    }
  } else if (type === 'triangles') {
    // Generate random triangles
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 40 + Math.random() * 80;
      
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.fill();
    }
  }
  
  ctx.restore();
}

// Helper function to adjust color brightness
function adjustBrightness(color: string, percent: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const newR = Math.max(0, Math.min(255, r + (r * percent / 100)));
  const newG = Math.max(0, Math.min(255, g + (g * percent / 100)));
  const newB = Math.max(0, Math.min(255, b + (b * percent / 100)));
  
  return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
}

export interface FloorPlanPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function drawStoryCanvas(
  canvas: HTMLCanvasElement,
  propertyData: PropertyFormData,
  backgroundImage: File | null,
  floorPlan: File | null,
  floorPlanPosition?: FloorPlanPosition,
  backgroundPosition?: BackgroundPosition,
  backgroundColor?: string,
  showEditingHandles: boolean = true,
  selectedPattern?: string | null,
  geometricPattern?: string | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Clear canvas with pattern, geometric pattern, custom color, or gradient background
  if (selectedPattern) {
    // Pattern background is handled in the calling component, skip background fill
    // The canvas already has the pattern drawn when this function is called
  } else if (geometricPattern && backgroundColor) {
    // Generate geometric pattern background
    generateGeometricBackground(ctx, geometricPattern, backgroundColor);
  } else if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, "hsl(217, 91%, 60%)");
    gradient.addColorStop(1, "hsl(217, 91%, 45%)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Draw background image if available
  if (backgroundImage) {
    try {
      const img = await loadImage(backgroundImage);
      
      let bgX, bgY, bgWidth, bgHeight;
      
      // Use custom background position if provided
      if (backgroundPosition) {
        bgX = backgroundPosition.x;
        bgY = backgroundPosition.y;
        bgWidth = backgroundPosition.width;
        bgHeight = backgroundPosition.height;
        ctx.drawImage(img, bgX, bgY, bgWidth, bgHeight);
      } else {
        const { x, y, width, height } = calculateImageFit(img, CANVAS_WIDTH, CANVAS_HEIGHT * 0.7);
        bgX = x;
        bgY = y + 150;
        bgWidth = width;
        bgHeight = height;
        ctx.drawImage(img, bgX, bgY, bgWidth, bgHeight);
      }
      
      // Only show editing handles in preview mode
      if (showEditingHandles) {
        // Draw visible border around background image
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        ctx.setLineDash([]);
        
        // Draw visible resize handle for background image
        const bgHandleX = bgX + bgWidth - 20;
        const bgHandleY = bgY + bgHeight - 20;
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillRect(bgHandleX, bgHandleY, 20, 20);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bgHandleX, bgHandleY, 20, 20);
        
        // Draw resize icon for background
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bgHandleX + 6, bgHandleY + 14);
        ctx.lineTo(bgHandleX + 14, bgHandleY + 6);
        ctx.moveTo(bgHandleX + 10, bgHandleY + 14);
        ctx.lineTo(bgHandleX + 14, bgHandleY + 10);
        ctx.moveTo(bgHandleX + 6, bgHandleY + 10);
        ctx.lineTo(bgHandleX + 10, bgHandleY + 6);
        ctx.stroke();
      }
      
      // Add dark overlay only over background image for text readability
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    } catch (error) {
      console.error("Failed to load background image:", error);
    }
  }

  // Draw floor plan overlay BEFORE text elements so text appears on top
  if (floorPlan) {
    try {
      const planImg = await loadImage(floorPlan);
      
      // Use custom position if provided, otherwise use centered default
      const planWidth = floorPlanPosition?.width || 400;
      const planHeight = floorPlanPosition?.height || 300;
      const planX = floorPlanPosition?.x || (CANVAS_WIDTH / 2 - planWidth / 2);
      const planY = floorPlanPosition?.y || 650;
      
      // Draw floor plan image with minimal padding
      const { x, y, width, height } = calculateImageFit(planImg, planWidth - 4, planHeight - 4);
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 10;
      ctx.drawImage(planImg, planX + 2 + x, planY + 2 + y, width, height);
      ctx.shadowBlur = 0;
      
      // Only show editing handles in preview mode
      if (showEditingHandles) {
        // Draw semi-transparent border around floor plan for visibility
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(planX, planY, planWidth, planHeight);
        ctx.setLineDash([]);
        
        // Draw visible resize handle for floor plan
        const handleX = planX + planWidth - 20;
        const handleY = planY + planHeight - 20;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(handleX, handleY, 20, 20);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(handleX, handleY, 20, 20);
        
        // Draw resize icon
        ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(handleX + 6, handleY + 14);
        ctx.lineTo(handleX + 14, handleY + 6);
        ctx.moveTo(handleX + 10, handleY + 14);
        ctx.lineTo(handleX + 14, handleY + 10);
        ctx.moveTo(handleX + 6, handleY + 10);
        ctx.lineTo(handleX + 10, handleY + 6);
        ctx.stroke();
      }
    } catch (error) {
      console.error("Failed to load floor plan:", error);
    }
  }

  // Draw header text
  ctx.fillStyle = "white";
  ctx.font = "bold 64px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.fillText(
    propertyData.propertyAddress.toUpperCase() || "АДРЕС НЕ УКАЗАН",
    CANVAS_WIDTH / 2,
    150
  );
  ctx.shadowBlur = 0;

  // Draw financial info card
  const cardY = CANVAS_HEIGHT - 600;
  const cardHeight = 300;
  const cardPadding = 40;

  // Card background with blur effect
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(cardPadding, cardY, CANVAS_WIDTH - cardPadding * 2, cardHeight);

  // Card content
  ctx.fillStyle = "white";
  ctx.textAlign = "left";

  // Left side - Property info
  ctx.font = "32px Inter, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.fillText(
    mortgageTypeLabels[propertyData.mortgageType as keyof typeof mortgageTypeLabels] || "БАЗОВАЯ ИПОТЕКА",
    cardPadding + 30,
    cardY + 60
  );

  ctx.font = "bold 40px Inter, sans-serif";
  ctx.fillStyle = "white";
  ctx.fillText(
    propertyTypeLabels[propertyData.propertyType] || "ТИП НЕ УКАЗАН",
    cardPadding + 30,
    cardY + 110
  );

  ctx.font = "32px Inter, sans-serif";
  ctx.fillText(
    `${propertyData.propertyArea || 0} м²`,
    cardPadding + 30,
    cardY + 150
  );

  // Right side - Monthly payment
  ctx.textAlign = "right";
  ctx.font = "32px Inter, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.fillText("Ежемесячный платёж:", CANVAS_WIDTH - cardPadding - 30, cardY + 60);

  ctx.font = "bold 56px Inter, sans-serif";
  ctx.fillStyle = "white";
  ctx.fillText(
    `${formatCurrency(propertyData.monthlyPayment)} ₽`,
    CANVAS_WIDTH - cardPadding - 30,
    cardY + 120
  );

  // Bank rate - Enhanced visibility
  ctx.textAlign = "left";
  ctx.font = "24px Inter, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.fillText("Ставка:", cardPadding + 30, cardY + 200);
  
  // Rate value with highlight box
  const rateText = `${propertyData.bankRate || 0}%`;
  ctx.font = "bold 36px Inter, sans-serif";
  const rateMetrics = ctx.measureText(rateText);
  const rateBoxWidth = rateMetrics.width + 20;
  const rateBoxHeight = 50;
  const rateBoxX = cardPadding + 120;
  const rateBoxY = cardY + 175;
  
  // Rate highlight background
  ctx.fillStyle = "#3B82F6";
  ctx.fillRect(rateBoxX, rateBoxY, rateBoxWidth, rateBoxHeight);
  
  // Rate text
  ctx.fillStyle = "white";
  ctx.fillText(rateText, rateBoxX + 10, rateBoxY + 32);


  // Bottom info with improved visibility and left alignment
  const bottomY = CANVAS_HEIGHT - 160;
  const leftPadding = 60;
  
  ctx.font = "bold 48px Inter, sans-serif";
  
  // Add strong text shadow for mobile visibility
  ctx.shadowColor = "rgba(0, 0, 0, 1)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  
  // First payment on first line
  ctx.fillText(
    `Первый взнос: ${formatCurrency(propertyData.initialPayment)} ₽`,
    leftPadding,
    bottomY
  );

  // Total cost on second line
  ctx.fillText(
    `Стоимость: ${formatCurrency(propertyData.totalCost)} ₽`,
    leftPadding,
    bottomY + 60
  );
  
  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Bank logo with better visibility
  ctx.textAlign = "right";
  ctx.font = "bold 36px Inter, sans-serif";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(
    bankLogos[propertyData.selectedBank] || "БАНК НЕ УКАЗАН",
    CANVAS_WIDTH - cardPadding - 30,
    bottomY + 70
  );
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    
    img.src = url;
  });
}

function calculateImageFit(
  img: HTMLImageElement,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  const imgAspect = img.width / img.height;
  const containerAspect = containerWidth / containerHeight;

  let width, height, x, y;

  if (imgAspect > containerAspect) {
    // Image is wider than container
    width = containerWidth;
    height = containerWidth / imgAspect;
    x = 0;
    y = (containerHeight - height) / 2;
  } else {
    // Image is taller than container
    width = containerHeight * imgAspect;
    height = containerHeight;
    x = (containerWidth - width) / 2;
    y = 0;
  }

  return { x, y, width, height };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}
