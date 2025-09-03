import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { StoryCanvas } from "@/components/story-canvas";
import { propertyFormSchema, type PropertyFormData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Home, Calculator, DraftingCompass, University, Eye, Download, Save, Share, HelpCircle, FolderOpen, CreditCard } from "lucide-react";
import { Link } from "wouter";

// Import bank logos
import sovkombankLogo from "@/assets/images/sovkombank-logo.png";
import sberbankLogo from "@/assets/images/sberbank-logo.png";
import vtbLogo from "@/assets/images/vtb-logo.png";
import alfabankLogo from "@/assets/images/alfabank-logo.png";
import tinkoffLogo from "@/assets/images/tinkoff-logo.png";

// Import background patterns
import blueGeometricPattern from "@/assets/patterns/blue-geometric.png";
import purpleWavePattern from "@/assets/patterns/purple-wave.png";
import greenHexagonalPattern from "@/assets/patterns/green-hexagonal.png";
import orangeCirclesPattern from "@/assets/patterns/orange-circles.png";

export default function StoryGenerator() {
  const { toast } = useToast();
  const [location] = useLocation();
  const templateId = new URLSearchParams(window.location.search).get('template');
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [floorPlan, setFloorPlan] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#3b82f6");
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [selectedGeometric, setSelectedGeometric] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPositions, setCurrentPositions] = useState<{
    floorPlan: any;
    background: any;
  }>({ floorPlan: null, background: null });
  
  // Query to load existing template if templateId is present
  const { data: loadedTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["/api/templates", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const response = await fetch(`/api/templates/${templateId}`);
      if (!response.ok) throw new Error('Template not found');
      return response.json();
    },
    enabled: !!templateId
  });

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      name: "Новый проект",
      propertyAddress: "",
      propertyType: "2k",
      propertyArea: 0,
      totalCost: 0,
      initialPayment: 0,
      bankRate: 0,
      monthlyPayment: 0,
      selectedBank: "sovkombank",
      mortgageType: "basic",
    },
  });

  // Calculate monthly payment automatically
  const calculateMonthlyPayment = (totalCost: number, initialPayment: number, rate: number, years: number = 30) => {
    if (totalCost <= 0 || initialPayment < 0 || rate <= 0) return 0;
    
    const loanAmount = totalCost - initialPayment;
    if (loanAmount <= 0) return 0;
    
    const monthlyRate = rate / 100 / 12;
    const totalPayments = years * 12;
    
    const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
                          (Math.pow(1 + monthlyRate, totalPayments) - 1);
    
    return Math.round(monthlyPayment * 100) / 100; // Round to 2 decimal places
  };

  // Watch form values for auto-calculation without causing infinite loop
  const watchedValues = form.watch(["totalCost", "initialPayment", "bankRate"]);
  
  useEffect(() => {
    const [totalCost, initialPayment, bankRate] = watchedValues;
    if (totalCost && initialPayment !== undefined && bankRate) {
      const newPayment = calculateMonthlyPayment(totalCost, initialPayment, bankRate);
      const currentPayment = form.getValues("monthlyPayment");
      // Only update if the value is different to prevent infinite loops
      if (Math.abs(newPayment - currentPayment) > 0.01) {
        form.setValue("monthlyPayment", newPayment, { shouldValidate: false });
      }
    }
  }, [watchedValues, form]);

  // Load template data when available
  useEffect(() => {
    if (loadedTemplate && !form.formState.isDirty) {
      form.reset({
        name: loadedTemplate.name,
        propertyAddress: loadedTemplate.propertyAddress,
        propertyType: loadedTemplate.propertyType,
        propertyArea: loadedTemplate.propertyArea,
        totalCost: loadedTemplate.totalCost,
        initialPayment: loadedTemplate.initialPayment,
        bankRate: loadedTemplate.bankRate,
        monthlyPayment: loadedTemplate.monthlyPayment,
        selectedBank: loadedTemplate.selectedBank,
        mortgageType: loadedTemplate.mortgageType || "basic",
      });
      
      // Load saved positions
      if (loadedTemplate.floorPlanPosition) {
        try {
          const floorPlanPos = JSON.parse(loadedTemplate.floorPlanPosition);
          setCurrentPositions(prev => ({ ...prev, floorPlan: floorPlanPos }));
        } catch (e) {
          console.warn('Failed to parse floor plan position:', e);
        }
      }
      if (loadedTemplate.backgroundPosition) {
        try {
          const backgroundPos = JSON.parse(loadedTemplate.backgroundPosition);
          setCurrentPositions(prev => ({ ...prev, background: backgroundPos }));
        } catch (e) {
          console.warn('Failed to parse background position:', e);
        }
      }
      
      // Load images if they exist  
      if (loadedTemplate.backgroundImageUrl || loadedTemplate.floorPlanUrl) {
        toast({
          title: "Шаблон загружен",
          description: "Пожалуйста, повторно загрузите изображения если необходимо",
        });
      }
    }
  }, [loadedTemplate, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: PropertyFormData) => {
      const formData = new FormData();
      
      // Add the name field with proper default
      const templateData = {
        ...data,
        name: data.name || "Новый проект"
      };
      
      // Include position data
      const templateWithPositions = {
        ...templateData,
        floorPlanPosition: currentPositions.floorPlan ? JSON.stringify(currentPositions.floorPlan) : undefined,
        backgroundPosition: currentPositions.background ? JSON.stringify(currentPositions.background) : undefined
      };
      
      formData.append("data", JSON.stringify(templateWithPositions));
      if (backgroundImage) formData.append("background", backgroundImage);
      if (floorPlan) formData.append("floorPlan", floorPlan);
      
      // If we're editing an existing template, use PUT method
      const method = templateId ? "PUT" : "POST";
      const url = templateId ? `/api/templates/${templateId}` : "/api/templates";
      
      return apiRequest(method, url, formData);
    },
    onSuccess: () => {
      toast({
        title: "Шаблон сохранён",
        description: "Ваш шаблон успешно сохранён",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить шаблон",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: PropertyFormData) => {
    if (!backgroundImage) {
      toast({
        title: "Ошибка",
        description: "Загрузите фон объекта",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Generate canvas here
      setTimeout(() => {
        setIsGenerating(false);
        toast({
          title: "Сторис готов!",
          description: "Изображение успешно создано",
        });
      }, 2000);
    } catch (error) {
      setIsGenerating(false);
      toast({
        title: "Ошибка",
        description: "Не удалось создать сторис",
        variant: "destructive",
      });
    }
  };

  const downloadImage = async () => {
    if (canvasRef.current) {
      // Create a temporary canvas for clean download without editing handles
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1080;
      tempCanvas.height = 1920;
      
      // Draw clean version without editing handles using current positions
      const { drawStoryCanvas } = await import('@/lib/canvas-utils');
      await drawStoryCanvas(
        tempCanvas,
        form.getValues(),
        backgroundImage,
        floorPlan,
        floorPlan ? currentPositions.floorPlan || {
          x: 440,
          y: 650, 
          width: 600,
          height: 400
        } : undefined,
        backgroundImage ? currentPositions.background || {
          x: 0,
          y: 150,
          width: 1080,
          height: 1350
        } : undefined,
        backgroundColor,
        false, // No editing handles
        selectedPattern,
        selectedGeometric
      );
      
      const link = document.createElement("a");
      link.download = "whatsapp-story.png";
      link.href = tempCanvas.toDataURL("image/png", 1.0);
      link.click();
    }
  };

  const bankOptions = {
    sovkombank: "Совкомбанк",
    sberbank: "Сбербанк",
    vtb: "ВТБ",
    alfabank: "Альфа-Банк",
    tinkoff: "Тинькофф",
  };

  const bankLogos = {
    sovkombank: sovkombankLogo,
    sberbank: sberbankLogo,
    vtb: vtbLogo,
    alfabank: alfabankLogo,
    tinkoff: tinkoffLogo,
  };

  const mortgageTypeOptions = {
    basic: "Базовая ипотека",
    family: "Семейная ипотека",
    it: "IT-ипотека",
  };

  const propertyTypeOptions = {
    "1k": "1К квартира",
    "2k": "2К квартира", 
    "3k": "3К квартира",
    studio: "Студия",
  };

  const backgroundPatterns = {
    "blue-geometric": { name: "Геометрический синий", image: blueGeometricPattern },
    "purple-wave": { name: "Фиолетовые волны", image: purpleWavePattern },
    "green-hexagonal": { name: "Зеленые шестиугольники", image: greenHexagonalPattern },
    "orange-circles": { name: "Оранжевые круги", image: orangeCirclesPattern },
  };

  const geometricPatterns = {
    "circles": { name: "Круги", preview: "○ ○ ○" },
    "triangles": { name: "Треугольники", preview: "△ △ △" },
  };

  if (isLoadingTemplate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка шаблона...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Home className="text-primary-foreground text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Story Render</h1>
              <p className="text-sm text-muted-foreground">Генератор для недвижимости</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Link href="/templates">
              <Button variant="outline" size="sm" data-testid="button-view-templates">
                <FolderOpen className="w-4 h-4 mr-2" />
                Мои шаблоны
              </Button>
            </Link>
            <Button variant="ghost" size="icon" data-testid="button-help">
              <HelpCircle className="text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid lg:grid-cols-2 gap-6 min-h-[calc(100vh-80px)]">
        {/* Control Panel */}
        <div className="space-y-6">
          {/* Background Upload */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Home className="text-primary mr-3" />
                Фон объекта
              </h2>
              <FileUpload
                onFileSelect={setBackgroundImage}
                accept="image/*"
                maxSize={10 * 1024 * 1024}
                placeholder="Загрузите фото объекта"
                description="PNG, JPG до 10MB"
                data-testid="upload-background"
              />
              {backgroundImage && (
                <div className="mt-4">
                  <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                    <div className="flex items-center">
                      <Home className="text-primary mr-3" />
                      <span className="text-sm text-foreground" data-testid="text-background-filename">
                        {backgroundImage.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBackgroundImage(null)}
                      data-testid="button-remove-background"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property Information */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Home className="text-primary mr-3" />
                Информация об объекте
              </h2>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="propertyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ул. Черкасская, 58/2"
                            {...field}
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="propertyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Тип жилья</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-property-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(propertyTypeOptions).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="propertyArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Площадь (м²)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="51.29"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              data-testid="input-area"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Financial Information */}
                  <div className="pt-4">
                    <h3 className="text-md font-semibold mb-4 flex items-center">
                      <Calculator className="text-primary mr-3" />
                      Финансовые условия
                    </h3>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="totalCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Стоимость объекта (₽)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="5922500"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-total-cost"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="initialPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Первый взнос (₽)</FormLabel>
                            <FormControl>
                              <div className="space-y-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="1783000"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-initial-payment"
                                />
                                {/* Quick Percentage Buttons */}
                                <div className="grid grid-cols-4 gap-2">
                                  {[20, 30, 40, 50].map((percentage) => (
                                    <Button
                                      key={percentage}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => {
                                        const totalCost = form.getValues("totalCost");
                                        if (totalCost > 0) {
                                          const amount = Math.round(totalCost * (percentage / 100));
                                          form.setValue("initialPayment", amount);
                                          field.onChange(amount);
                                        }
                                      }}
                                      data-testid={`button-${percentage}-percent`}
                                    >
                                      {percentage}%
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bankRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-bold text-primary">Ставка банка (%)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="14.99"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-bank-rate"
                                  className="text-lg font-bold text-primary border-2 border-primary bg-primary/5 focus:bg-primary/10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold text-primary">
                                  %
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="monthlyPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ежемесячный платёж (₽) - рассчитывается автоматически</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="52300.50"
                                {...field}
                                value={field.value}
                                readOnly
                                className="bg-muted"
                                data-testid="input-monthly-payment"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Floor Plan Upload */}
                  <div className="pt-4">
                    <h3 className="text-md font-semibold mb-4 flex items-center">
                      <DraftingCompass className="text-primary mr-3" />
                      Планировка
                    </h3>
                    <FileUpload
                      onFileSelect={setFloorPlan}
                      accept="image/*,.pdf"
                      maxSize={10 * 1024 * 1024}
                      placeholder="Загрузите план квартиры"
                      description="PNG, JPG, PDF"
                      data-testid="upload-floorplan"
                    />
                    {floorPlan && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                          <div className="flex items-center">
                            <DraftingCompass className="text-primary mr-3" />
                            <span className="text-sm text-foreground" data-testid="text-floorplan-filename">
                              {floorPlan.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFloorPlan(null)}
                            data-testid="button-remove-floorplan"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bank Selection */}
                  <div className="pt-4">
                    <h3 className="text-md font-semibold mb-4 flex items-center">
                      <University className="text-primary mr-3" />
                      Банк-партнёр
                    </h3>
                    <FormField
                      control={form.control}
                      name="selectedBank"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-bank">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(bankOptions).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  <div className="flex items-center space-x-3">
                                    <img 
                                      src={bankLogos[value as keyof typeof bankLogos]} 
                                      alt={`${label} logo`}
                                      className="w-6 h-6 object-contain"
                                    />
                                    <span>{label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Mortgage Type Selection */}
                  <div className="pt-4">
                    <h3 className="text-md font-semibold mb-4 flex items-center">
                      <CreditCard className="text-primary mr-3" />
                      Тип ипотеки
                    </h3>
                    <FormField
                      control={form.control}
                      name="mortgageType"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-mortgage-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(mortgageTypeOptions).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Background Selection */}
                  <div className="pt-4">
                    <h3 className="text-md font-semibold mb-4 flex items-center">
                      <DraftingCompass className="text-primary mr-3" />
                      Фон сторис
                    </h3>
                    
                    {/* Color Picker */}
                    <div className="mb-4">
                      <Label htmlFor="bg-color" className="text-sm text-muted-foreground mb-2 block">
                        Однотонный цвет:
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="bg-color"
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => {
                            setBackgroundColor(e.target.value);
                            setSelectedPattern(null);
                          }}
                          className="w-16 h-10 border-2 cursor-pointer"
                          data-testid="input-background-color"
                        />
                        <span className="text-sm text-muted-foreground">или выберите паттерн ниже</span>
                      </div>
                    </div>

                    {/* Pattern Selection */}
                    <div className="mb-4">
                      <Label className="text-sm text-muted-foreground mb-2 block">
                        Абстрактные паттерны:
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(backgroundPatterns).map(([key, pattern]) => (
                          <div
                            key={key}
                            className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                              selectedPattern === key 
                                ? 'border-primary ring-2 ring-primary/30' 
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              setSelectedPattern(key);
                              setSelectedGeometric(null);
                              setBackgroundColor("#3b82f6");
                            }}
                          >
                            <img
                              src={pattern.image}
                              alt={pattern.name}
                              className="w-full h-20 object-cover"
                            />
                            <div className="p-2 bg-background/90 backdrop-blur-sm">
                              <span className="text-xs font-medium">{pattern.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Geometric Patterns */}
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2 block">
                        Геометрические фигуры:
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(geometricPatterns).map(([key, pattern]) => (
                          <div
                            key={key}
                            className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                              selectedGeometric === key 
                                ? 'border-primary ring-2 ring-primary/30 bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              setSelectedGeometric(key);
                              setSelectedPattern(null);
                            }}
                          >
                            <div className="text-2xl mb-2 text-primary">
                              {pattern.preview}
                            </div>
                            <span className="text-xs font-medium">{pattern.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isGenerating}
                    data-testid="button-generate-story"
                  >
                    {isGenerating ? "Создание сторис..." : "Создать сторис"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center">
                <Eye className="text-primary mr-3" />
                Предварительный просмотр
              </h2>
              <div className="flex space-x-2">
                <Button variant="ghost" size="icon" data-testid="button-reset-canvas">
                  <span className="text-muted-foreground">↻</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={downloadImage} data-testid="button-download">
                  <Download className="text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Story Canvas */}
            <div className="flex justify-center">
              <StoryCanvas
                ref={canvasRef}
                propertyData={form.watch()}
                backgroundImage={backgroundImage}
                floorPlan={floorPlan}
                backgroundColor={backgroundColor}
                selectedPattern={selectedPattern}
                selectedGeometric={selectedGeometric}
                initialFloorPlanPosition={currentPositions.floorPlan}
                initialBackgroundPosition={currentPositions.background}
                onPositionChange={useCallback((floorPlan: any, background: any) => {
                  setCurrentPositions({ floorPlan, background });
                }, [])}
              />
            </div>

            {/* Preview Actions */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button
                variant="secondary"
                onClick={() => saveMutation.mutate(form.getValues())}
                disabled={saveMutation.isPending}
                data-testid="button-save-template"
              >
                <Save className="mr-2 h-4 w-4" />
                Сохранить шаблон
              </Button>
              <Button variant="outline" data-testid="button-share">
                <Share className="mr-2 h-4 w-4" />
                Поделиться
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-foreground font-medium">Создание сторис...</p>
              <p className="text-sm text-muted-foreground mt-2">Это займёт несколько секунд</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
