"use client";

import { useState, useEffect, useRef } from "react";
import type { ApplicationContext, PagesContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/utils/hooks/useMarketplaceClient";
import { RotateCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface BrandKit {
  id: string;
  brandName: string;
}

interface BrandSection {
  id: string;
  name: string;
}

type Step = 1 | 2 | 3;

export default function Home() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  const [pagesContext, setPagesContext] = useState<PagesContext>();
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewResults, setReviewResults] = useState<any[]>([]);
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [brandSections, setBrandSections] = useState<BrandSection[]>([]);
  const [selectedBrandKitId, setSelectedBrandKitId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [loadingSections, setLoadingSections] = useState<boolean>(false);
  const [isContextLoading, setIsContextLoading] = useState<boolean>(true);
  const [extractionResults, setExtractionResults] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const lastPageIdRef = useRef<string | undefined>(undefined);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!error && isInitialized && client) {
      console.log("Marketplace client initialized successfully.");

      client
        .query("application.context")
        .then((res) => {
          console.log("Success retrieving application.context:", res.data);
          setAppContext(res.data);
        })
        .catch((err) => {
          console.error("Error retrieving application.context:", err);
        });

      const initialQuery = async () => {

        try {
          client?.query("pages.context", {
            subscribe: true,
            onSuccess: (data) => {
              console.log("Page has been updated:", data);
        
              if (!data.pageInfo) {
                console.warn("No page info in refresh response");
                setIsContextLoading(false);
                return;
              }
        
              const currentPageId = data.pageInfo.id;
              console.log(
                "Page context initialized / updated. Page ID:",
                currentPageId,
                "Previous ID:",
                lastPageIdRef.current
              );
        
              lastPageIdRef.current = currentPageId;
              setPagesContext(data);
              setReviewStatus("");
              setReviewResults([]);
              setExtractionResults(null);
              setCurrentStep(1);
              setIsContextLoading(false);
              hasInitializedRef.current = true;
            },
            onError: (error) => {
              console.error("Error retrieving pages.context:", error);
              setIsContextLoading(false);
            }
          });
        } catch (err) {
          console.error("Error retrieving pages.context:", err);
          setIsContextLoading(false);
        };
      };

      initialQuery();

      const fetchBrandKits = async () => {
        try {
          const response = await fetch("/api/brandkits");
          if (response.ok) {
            const data = await response.json();
            const kits = Array.isArray(data) ? data : data.brandkits || data.data || [];
            setBrandKits(kits);
          } else {
            console.error("Failed to fetch brand kits:", response.status);
          }
        } catch (err) {
          console.error("Error fetching brand kits:", err);
        }
      };

      fetchBrandKits();
    } else if (error) {
      console.error("Error initializing Marketplace client:", error);
    }
  }, [client, error, isInitialized]);

  useEffect(() => {
    if (selectedBrandKitId) {
      setSelectedSectionId("");
      fetchBrandSections(selectedBrandKitId);
    }
  }, [selectedBrandKitId]);

  const fetchBrandSections = async (brandkitId: string) => {
    setLoadingSections(true);
    try {
      const response = await fetch(`/api/brandsections?brandkitId=${brandkitId}`);
      if (response.ok) {
        const data = await response.json();
        const sections = Array.isArray(data) ? data : data.sections || data.data || [];
        setBrandSections(sections);
        setSelectedSectionId("all");
      } else {
        console.error("Failed to fetch brand sections:", response.status);
        setBrandSections([]);
      }
    } catch (err) {
      console.error("Error fetching brand sections:", err);
      setBrandSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  const sendToBrandReview = async () => {
    if (!pagesContext?.pageInfo) {
      setReviewStatus("No page content available to review");
      return;
    }

    if (!selectedSectionId) {
      setReviewStatus("Please select a brand section");
      return;
    }

    try {
      setIsReviewing(true);

      const graphqlQuery = `
      query {
          item(path: "${pagesContext.pageInfo.path}",language:"${pagesContext.pageInfo.language}") {
            ...on ${pagesContext.pageInfo?.template?.name}{
              title{
                value
              },
              content{
                value
              }
            }
          }
        }
        `;

      const graphqlResponse = await client?.mutate("xmc.preview.graphql", {
        params: {
          query: {
            sitecoreContextId: appContext?.resourceAccess?.[0]?.context?.preview,
          },
          body: {
            query: graphqlQuery,
          },
        },
      });
      console.log("Success retrieving query:", graphqlQuery);
      const itemData = graphqlResponse?.data?.data as {
        item?: { title?: { value?: string }; content?: { value?: string } };
      } | undefined;
      const title = itemData?.item?.title?.value || "";
      const content = itemData?.item?.content?.value || "";

      const response = await fetch("/api/brandreview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandkitId: selectedBrandKitId,
          input: {
            content: title + " " + content,
          },
          sections: selectedSectionId === "all" ? brandSections.map((section) => ({ sectionId: section.id })) : [{ sectionId: selectedSectionId }],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setReviewResults(result);
        //setReviewStatus("Brand review completed successfully!");
        setCurrentStep(2);
      } else {
        const errorText = await response.text();
        setReviewStatus(
          `Failed to send: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
    } catch (err) {
      console.error("Error sending to brand review:", err);
      setReviewStatus(
        `Error sending to brand review: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const generateOptimizedContent = async () => {
    if (reviewResults.length === 0) {
      setReviewStatus("No review results to optimize");
      return;
    }

    if (!pagesContext?.pageInfo) {
      setReviewStatus("No page content available");
      return;
    }

    try {
      setIsExtracting(true);

      let initialTitle = "";
      let initialContent = "";

      const sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.preview;

      const pageInfo = pagesContext.pageInfo!;

      const fetchViaApi = async () => {
        const res = await fetch("/api/page-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pageInfo.path,
            language: pageInfo.language,
            templateName: pageInfo.template?.name,
            sitecoreContextId,
          }),
        });
        if (res.ok) {
          const { title, content } = await res.json();
          return { title: title ?? "", content: content ?? "" };
        }
        return null;
      };

      const fetchViaGraphQL = async () => {
        if (!client || !sitecoreContextId) return null;
        const graphqlQuery = `
          query {
            item(path: "${pageInfo.path?.replace(/"/g, '\\"') ?? ""}", language: "${pageInfo.language ?? ""}") {
              ... on ${pageInfo.template?.name ?? "Item"} {
                title { value }
                content { value }
              }
            }
          }
        `;
        const graphqlResponse = await client.mutate("xmc.preview.graphql", {
          params: {
            query: { sitecoreContextId },
            body: { query: graphqlQuery },
          },
        });
        const raw = graphqlResponse?.data as Record<string, unknown> | undefined;
        const dataObj = raw?.data ?? raw;
        const item = (dataObj as Record<string, { title?: { value?: string }; content?: { value?: string } } | undefined>)?.item;
        if (item) {
          return {
            title: item.title?.value ?? "",
            content: item.content?.value ?? "",
          };
        }
        return null;
      };

      const fromPageInfo = () => ({
        title: pageInfo.displayName ?? pageInfo.name ?? "",
        content: "",
      });

      let result = await fetchViaGraphQL();
      if (!result || (!result.title && !result.content)) {
        result = await fetchViaApi();
      }
      if (!result || (!result.title && !result.content)) {
        result = fromPageInfo();
      }
      if (result) {
        initialTitle = result.title;
        initialContent = result.content;
      }

      const requestBody = {
        systemPrompt:
          "- Create a title and content for a news article - use the list of suggestions provided in the prompt",
        prompt: "list of suggestions for text optimization: " + reviewResults.map((res, index) => {
          return "suggestion " + (index + 1) + ": " + (res.suggestion ?? "");
        }).join(" - "),
        input: {
          initialTitle: initialTitle,
          initialContent: initialContent,
        },
        attributes: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            optimizedContent: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
        name: "brandreview-suggestion",
        description:
          "Improve title and content based on brand review suggestions",
      };

      const response = await fetch("/api/extractions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        setExtractionResults(result);
        setCurrentStep(3);
      } else {
        const errorText = await response.text();
        setReviewStatus(
          `Failed to generate content: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
    } catch (err) {
      console.error("Error generating optimized content:", err);
      setReviewStatus(
        `Error generating optimized content: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const goBackToStep = (step: Step) => {
    setCurrentStep(step);
    setReviewStatus("");
  };

  const getScoreBadgeVariant = (score: number): "danger" | "warning" | "primary" | "success" | "neutral" => {
    switch (score) {
      case 1:
        return "danger";
      case 2:
      case 3:
        return "warning";
      case 4:
        return "success";
      default:
        return "neutral";
    }
  };

  const getResultBoxClasses = (variant: ReturnType<typeof getScoreBadgeVariant>) => {
    const base = "p-5 rounded-lg bg-gray-50/50 dark:bg-gray-800/50";
    const borderMap = {
      danger: "border-danger",
      warning: "border-warning",
      success: "border-success",
      primary: "border-primary",
      neutral: "border-border",
    };
    return cn(base, "border", borderMap[variant]);
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-8">
      {([1, 2, 3] as const).map((step) => (
        <div
          key={step}
          className={cn("flex items-center", step === 3 ? "flex-none" : "flex-1")}
        >
          <Button
            variant={step <= currentStep ? "default" : "ghost"}
            size="icon"
            colorScheme={step <= currentStep ? "primary" : "neutral"}
            onClick={() => goBackToStep(step)}
            disabled={step > currentStep}
            className={cn(
              "rounded-full size-10 shrink-0",
              step > currentStep && "cursor-not-allowed opacity-50"
            )}
          >
            {step}
          </Button>
          {step < 3 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-4 transition-colors",
                step < currentStep ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-subtle-bg font-sans">
      <div className="max-w-[1200px] mx-auto px-6 py-10">

        <StepIndicator />

        {/* Step 1: Selection */}
        {currentStep === 1 && (
          <>

            {isContextLoading && (
              <div className="flex justify-center items-center min-h-[200px] gap-3">
                <Spinner className="size-10 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Loading page context...
                </span>
              </div>
            )}

            {!isContextLoading && pagesContext?.pageInfo && (
              <Card style="outline" padding="lg" className="mb-8">
                <CardHeader>
                  <CardTitle>{pagesContext.pageInfo.displayName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">
                        Page ID
                      </p>
                      <p className="text-sm text-foreground m-0 break-all">
                        {pagesContext.pageInfo.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">
                        Language
                      </p>
                      <p className="text-sm text-foreground m-0">
                        {pagesContext.pageInfo.language}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
              <Field>
                <FieldContent>
                  <FieldLabel htmlFor="brandkit-select" className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">Brand Kit</FieldLabel>
                  <Select
                    value={selectedBrandKitId}
                    onValueChange={setSelectedBrandKitId}
                  >
                    <SelectTrigger
                      id="brandkit-select"
                      className="w-full"
                    >
                      <SelectValue placeholder="-- Select a brand kit --" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandKits.map((kit) => (
                        <SelectItem key={kit.id} value={kit.id}>
                          {kit.brandName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldContent>
                <FieldLabel htmlFor="brandkit-select" className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">Brand Section</FieldLabel>
                  <Select
                    value={selectedSectionId}
                    onValueChange={setSelectedSectionId}
                    disabled={
                      loadingSections ||
                      brandSections.length === 0 ||
                      !selectedBrandKitId
                    }
                  >
                    <SelectTrigger id="section-select" className="w-full">
                      <SelectValue
                        placeholder={
                          loadingSections
                            ? "-- Loading sections --"
                            : "-- Select a section --"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem key="all" value="all">
                          All Sections
                        </SelectItem>
                      {brandSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </div>

                  </div>

                  <Button
                    colorScheme="primary"
                    onClick={sendToBrandReview}
                    disabled={!selectedSectionId || isReviewing}
                  >
                    {isReviewing ? "Reviewing..." : "Review"}
                  </Button>

                  {reviewStatus && (
                    <Alert
                      variant={
                        reviewStatus.includes("successfully!")
                          ? "success"
                          : "danger"
                      }
                      className="mt-4"
                    >
                      <AlertDescription>{reviewStatus}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Step 2: Brand Review Results */}
        {currentStep === 2 && reviewResults.length > 0 && (() => {
          const aggregatedScore = reviewResults.length > 0
            ? reviewResults.reduce((sum, s) => sum + (s.score ?? 0), 0) / reviewResults.length
            : 0;
          const displayScore = aggregatedScore % 1 === 0
            ? aggregatedScore.toFixed(0)
            : aggregatedScore.toFixed(1);
          return (
          <Card style="outline" padding="lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Review Results</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Badge
                  colorScheme="blue"
                  size="lg"
                  className="mb-3 mr-2"
                >
                  Nbr Section{reviewResults.length > 1 ? 's' : ''} - {reviewResults.length}
              </Badge>
              <Badge
                colorScheme={getScoreBadgeVariant(Math.round(aggregatedScore))}
                size="lg"
                className="mb-2"
              >
                Avg Score - {displayScore}
              </Badge>
              <div className="grid gap-4 mb-6">
                {reviewResults.map((section, index) => (
                  <div
                    key={index}
                    className={getResultBoxClasses(getScoreBadgeVariant(section.score))}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-left">
                        {brandSections.find(bs => bs.id === section.sectionId)?.name}
                      </span>
                      <Badge
                        colorScheme={getScoreBadgeVariant(section.score)}
                        size="md"
                        className="shrink-0"
                      >
                        {section.score}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-1">
                        Reason
                      </p>
                      <p className="text-sm text-foreground m-0 leading-relaxed">
                        {section.reason}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-1">
                        Suggestion
                      </p>
                      <p className="text-sm text-foreground m-0 leading-relaxed">
                        {section.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <CardFooter className="flex gap-3 p-0">
                <Button
                  variant="default"
                  colorScheme="neutral"
                  onClick={() => goBackToStep(1)}
                >
                  Back
                </Button>
                <Button
                  colorScheme="primary"
                  onClick={generateOptimizedContent}
                  disabled={isExtracting}
                >
                  {isExtracting
                    ? "Generating..."
                    : "Optimize"}
                </Button>
              </CardFooter>

              {reviewStatus && (
                <Alert
                  variant={
                    reviewStatus.includes("Successfully") ? "success" : "danger"
                  }
                  className="mt-4"
                >
                  <AlertDescription>{reviewStatus}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          );
        })()}

        {/* Step 3: Optimized Content */}
        {currentStep === 3 && extractionResults && (
          <Card style="outline" padding="lg">
            <CardHeader>
              <CardTitle>Optimized Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 mb-6">
                <div>
                  <Field>
                    <FieldContent>
                      <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">
                      Title
                      </FieldLabel>
                        <Textarea
                          defaultValue={extractionResults.generated_attributes?.optimizedContent
                            ?.title ||
                            extractionResults.optimizedContent?.title ||
                            "No title generated"}
                          className="leading-relaxed break-words overflow-visible whitespace-normal"
                        />
                    </FieldContent>
                  </Field>

                </div>
                <div>
                  <Field>
                    <FieldContent>
                      <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase m-0 mb-2">
                      Content
                      </FieldLabel>
                        <Textarea
                          defaultValue={extractionResults.generated_attributes?.optimizedContent
                            ?.content ||
                          extractionResults.optimizedContent?.content ||
                          "No content generated"}
                          className="min-h-[250px] resize-y leading-relaxed break-words overflow-visible whitespace-normal"
                        />
                    </FieldContent>
                  </Field>
                </div>
              </div>

              <Button
                variant="default"
                colorScheme="neutral"
                onClick={() => goBackToStep(2)}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
