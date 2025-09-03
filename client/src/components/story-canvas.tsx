import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { PropertyFormData } from "@shared/schema";
import { drawStoryCanvas, FloorPlanPosition, BackgroundPosition } from "@/lib/canvas-utils";

// Import background patterns
import blueGeometricPattern from "@/assets/patterns/blue-geometric.png";
import purpleWavePattern from "@/assets/patterns/purple-wave.png";
import greenHexagonalPattern from "@/assets/patterns/green-hexagonal.png";
import orangeCirclesPattern from "@/assets/patterns/orange-circles.png";

interface StoryCanvasProps {
  propertyData: PropertyFormData;
  backgroundImage: File | null;
  floorPlan: File | null;
  backgroundColor?: string;
  selectedPattern?: string | null;
  selectedGeometric?: string | null;
  showEditingHandles?: boolean;
  initialFloorPlanPosition?: FloorPlanPosition;
  initialBackgroundPosition?: BackgroundPosition;
  onPositionChange?: (floorPlan: FloorPlanPosition, background: BackgroundPosition) => void;
}

export const StoryCanvas = forwardRef<HTMLCanvasElement, StoryCanvasProps>(
  ({ 
    propertyData, 
    backgroundImage, 
    floorPlan, 
    backgroundColor, 
    selectedPattern,
    selectedGeometric,
    showEditingHandles = true,
    initialFloorPlanPosition,
    initialBackgroundPosition,
    onPositionChange
  }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [floorPlanPosition, setFloorPlanPosition] = useState<FloorPlanPosition>(
      initialFloorPlanPosition || {
        x: 340,
        y: 650,
        width: 400,
        height: 300
      }
    );
    
    const [backgroundPosition, setBackgroundPosition] = useState<BackgroundPosition>(
      initialBackgroundPosition || {
        x: 0,
        y: 150,
        width: 1080,
        height: 1350
      }
    );
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [backgroundDragging, setBackgroundDragging] = useState(false);
    const [backgroundResizing, setBackgroundResizing] = useState(false);

    useImperativeHandle(ref, () => canvasRef.current!);

    const redrawCanvas = useCallback(async () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw pattern background first if selected
        if (selectedPattern) {
          const patternMap = {
            "blue-geometric": blueGeometricPattern,
            "purple-wave": purpleWavePattern,
            "green-hexagonal": greenHexagonalPattern,
            "orange-circles": orangeCirclesPattern,
          };

          const patternImage = patternMap[selectedPattern as keyof typeof patternMap];
          if (patternImage) {
            const img = new Image();
            img.onload = async () => {
              // Clear canvas
              canvas.width = 1080;
              canvas.height = 1920;
              
              // Draw pattern background
              ctx.drawImage(img, 0, 0, 1080, 1920);
              
              // Then draw story content on top
              await drawStoryCanvas(
                canvas, 
                propertyData, 
                backgroundImage, 
                floorPlan, 
                floorPlan ? floorPlanPosition : undefined,
                backgroundImage ? backgroundPosition : undefined,
                undefined, // Don't use solid color background
                showEditingHandles,
                selectedPattern,
                selectedGeometric
              );
            };
            img.src = patternImage;
            return;
          }
        }

        // Normal rendering without pattern
        await drawStoryCanvas(
          canvas, 
          propertyData, 
          backgroundImage, 
          floorPlan, 
          floorPlan ? floorPlanPosition : undefined,
          backgroundImage ? backgroundPosition : undefined,
          backgroundColor,
          showEditingHandles,
          selectedPattern,
          selectedGeometric
        );
      }
    }, [propertyData, backgroundImage, floorPlan, floorPlanPosition, backgroundPosition, backgroundColor, showEditingHandles, selectedPattern, selectedGeometric]);

    useEffect(() => {
      redrawCanvas();
    }, [redrawCanvas]);

    // Notify parent of position changes for saving (with debounce to prevent flickering)
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        if (onPositionChange) {
          onPositionChange(floorPlanPosition, backgroundPosition);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }, [floorPlanPosition, backgroundPosition, onPositionChange]);

    const getMousePos = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = 1080 / rect.width;
      const scaleY = 1920 / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const isInFloorPlan = (x: number, y: number) => {
      if (!floorPlan) return false;
      return x >= floorPlanPosition.x && x <= floorPlanPosition.x + floorPlanPosition.width &&
             y >= floorPlanPosition.y && y <= floorPlanPosition.y + floorPlanPosition.height;
    };

    const isInBackground = (x: number, y: number) => {
      if (!backgroundImage) return false;
      return x >= backgroundPosition.x && x <= backgroundPosition.x + backgroundPosition.width &&
             y >= backgroundPosition.y && y <= backgroundPosition.y + backgroundPosition.height;
    };

    const isInResizeHandle = (x: number, y: number) => {
      if (!floorPlan) return false;
      const handleX = floorPlanPosition.x + floorPlanPosition.width - 20;
      const handleY = floorPlanPosition.y + floorPlanPosition.height - 20;
      return x >= handleX && x <= handleX + 20 && y >= handleY && y <= handleY + 20;
    };

    const isInBackgroundResizeHandle = (x: number, y: number) => {
      if (!backgroundImage) return false;
      const handleX = backgroundPosition.x + backgroundPosition.width - 20;
      const handleY = backgroundPosition.y + backgroundPosition.height - 20;
      return x >= handleX && x <= handleX + 20 && y >= handleY && y <= handleY + 20;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const { x, y } = getMousePos(e);
      
      // Priority: Floor plan handles first, then background handles
      if (floorPlan && isInResizeHandle(x, y)) {
        setIsResizing(true);
        setDragStart({ x, y });
        return;
      }
      
      if (backgroundImage && isInBackgroundResizeHandle(x, y)) {
        setBackgroundResizing(true);
        setDragStart({ x, y });
        return;
      }
      
      if (floorPlan && isInFloorPlan(x, y)) {
        setIsDragging(true);
        setDragStart({
          x: x - floorPlanPosition.x,
          y: y - floorPlanPosition.y
        });
        return;
      }
      
      if (backgroundImage && isInBackground(x, y)) {
        setBackgroundDragging(true);
        setDragStart({
          x: x - backgroundPosition.x,
          y: y - backgroundPosition.y
        });
        return;
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      e.preventDefault();
      const { x, y } = getMousePos(e);

      // Handle active dragging/resizing operations
      if (isDragging && floorPlan) {
        const newPosition = {
          ...floorPlanPosition,
          x: Math.max(0, Math.min(1080 - floorPlanPosition.width, x - dragStart.x)),
          y: Math.max(200, Math.min(1720 - floorPlanPosition.height, y - dragStart.y))
        };
        setFloorPlanPosition(newPosition);
        return;
      }
      
      if (isResizing && floorPlan) {
        const newWidth = Math.max(100, x - floorPlanPosition.x);
        const newHeight = Math.max(75, y - floorPlanPosition.y);
        const newPosition = {
          ...floorPlanPosition,
          width: Math.min(newWidth, 1070 - floorPlanPosition.x),
          height: Math.min(newHeight, 1910 - floorPlanPosition.y)
        };
        setFloorPlanPosition(newPosition);
        return;
      }
      
      if (backgroundDragging && backgroundImage) {
        const newPosition = {
          ...backgroundPosition,
          x: Math.max(-200, Math.min(1280, x - dragStart.x)),
          y: Math.max(0, Math.min(1920 - backgroundPosition.height, y - dragStart.y))
        };
        setBackgroundPosition(newPosition);
        return;
      }
      
      if (backgroundResizing && backgroundImage) {
        const newWidth = Math.max(400, x - backgroundPosition.x);
        const newHeight = Math.max(300, y - backgroundPosition.y);
        const newPosition = {
          ...backgroundPosition,
          width: Math.min(newWidth, 1480 - backgroundPosition.x),
          height: Math.min(newHeight, 2220 - backgroundPosition.y)
        };
        setBackgroundPosition(newPosition);
        return;
      }

      // Set cursor based on hover area when not dragging
      if (canvasRef.current) {
        let cursor = 'default';
        
        if (floorPlan && isInResizeHandle(x, y)) {
          cursor = 'nw-resize';
        } else if (backgroundImage && isInBackgroundResizeHandle(x, y)) {
          cursor = 'nw-resize';
        } else if (floorPlan && isInFloorPlan(x, y)) {
          cursor = 'move';
        } else if (backgroundImage && isInBackground(x, y)) {
          cursor = 'move';
        }
        
        canvasRef.current.style.cursor = cursor;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setBackgroundDragging(false);
      setBackgroundResizing(false);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
    };

    return (
      <div className="story-canvas w-full max-w-sm bg-muted rounded-lg overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="w-full h-full"
          data-testid="canvas-story-preview"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {(floorPlan || backgroundImage) && (
          <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-3 py-2 rounded-lg max-w-sm border border-white/20">
            <div className="font-medium mb-1">📱 Управление сторисом</div>
            {floorPlan && (
              <div className="flex items-center mb-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Планировку можно перетаскивать
              </div>
            )}
            {backgroundImage && (
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                Фон тоже можно передвигать
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

StoryCanvas.displayName = "StoryCanvas";
