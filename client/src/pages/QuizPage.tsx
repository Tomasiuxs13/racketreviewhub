import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import type { Racket } from "@shared/schema";
import { getRacketSlug } from "@/lib/utils";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface QuizAnswer {
  label: string;
  value: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  description: string;
  answers: QuizAnswer[];
}

const questions: QuizQuestion[] = [
  {
    id: "level",
    question: "What's your playing level?",
    description: "Be honest - this is the most important factor for choosing the right racket.",
    answers: [
      { label: "Beginner", value: "beginner" },
      { label: "Intermediate", value: "intermediate" },
      { label: "Advanced", value: "advanced" },
      { label: "Professional", value: "professional" },
    ],
  },
  {
    id: "style",
    question: "How do you like to play?",
    description: "Think about what feels most natural when you're on court.",
    answers: [
      { label: "Aggressive & powerful", value: "power" },
      { label: "Defensive & controlled", value: "control" },
      { label: "A bit of both", value: "balance" },
    ],
  },
  {
    id: "priority",
    question: "What matters most to you?",
    description: "If you had to choose one thing to optimize for.",
    answers: [
      { label: "Maximum power on smashes", value: "power" },
      { label: "Large sweet spot & forgiveness", value: "sweetspot" },
      { label: "Maneuverability & speed", value: "maneuverability" },
      { label: "Best value for money", value: "value" },
    ],
  },
  {
    id: "budget",
    question: "What's your budget?",
    description: "All prices are in EUR.",
    answers: [
      { label: "Under €100", value: "low" },
      { label: "€100 - €200", value: "mid" },
      { label: "€200 - €300", value: "high" },
      { label: "No budget limit", value: "any" },
    ],
  },
];

function scoreRacket(racket: Racket, answers: Record<string, string>): number {
  let score = 0;

  // Level matching
  const level = answers.level;
  if (level === "beginner") {
    score += racket.controlRating * 1.5;
    score += racket.sweetSpotRating * 1.2;
    if (racket.shape === "round") score += 20;
    if (racket.gameLevel?.toLowerCase() === "beginner") score += 15;
  } else if (level === "intermediate") {
    score += racket.controlRating;
    score += racket.powerRating * 0.8;
    score += racket.maneuverabilityRating;
    if (racket.shape === "teardrop") score += 15;
    if (racket.gameLevel?.toLowerCase() === "intermediate") score += 15;
  } else if (level === "advanced" || level === "professional") {
    score += racket.powerRating * 1.3;
    score += racket.reboundRating;
    if (racket.shape === "diamond") score += 15;
    if (racket.shape === "teardrop") score += 8;
    if (racket.gameLevel?.toLowerCase() === "advanced" || racket.gameLevel?.toLowerCase() === "professional") score += 15;
  }

  // Play style
  const style = answers.style;
  if (style === "power") {
    score += racket.powerRating * 1.2;
    score += racket.reboundRating * 0.8;
  } else if (style === "control") {
    score += racket.controlRating * 1.3;
    score += racket.sweetSpotRating;
  } else {
    score += racket.overallRating * 1.1;
  }

  // Priority
  const priority = answers.priority;
  if (priority === "power") {
    score += racket.powerRating * 1.5;
  } else if (priority === "sweetspot") {
    score += racket.sweetSpotRating * 1.5;
  } else if (priority === "maneuverability") {
    score += racket.maneuverabilityRating * 1.5;
  } else if (priority === "value") {
    const price = Number(racket.currentPrice);
    if (price > 0 && price < 150) score += 40;
    else if (price < 200) score += 20;
    score += racket.overallRating;
  }

  // Budget filter (strong penalty if out of budget)
  const budget = answers.budget;
  const price = Number(racket.currentPrice);
  if (budget === "low" && price > 100) score -= 100;
  if (budget === "mid" && price > 200) score -= 50;
  if (budget === "high" && price > 300) score -= 30;

  return score;
}

export default function QuizPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const { data: rackets } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
  });

  const results = useMemo(() => {
    if (!rackets || !showResults) return [];
    return rackets
      .filter((r) => r.isPublished !== false && r.inStock !== false)
      .map((r) => ({ racket: r, score: scoreRacket(r, answers) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [rackets, answers, showResults]);

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setAnswers({});
    setShowResults(false);
  };

  const seoData = {
    title: "Find Your Perfect Padel Racket - Recommendation Quiz",
    description: "Answer 4 quick questions and we'll recommend the best padel racket for your playing level, style, and budget.",
    url: "/quiz",
    canonical: "/quiz",
  };

  return (
    <>
      <SEO {...seoData} />
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Breadcrumbs items={[{ label: "Quiz" }]} />

          {!showResults ? (
            <>
              {/* Progress */}
              <div className="flex items-center gap-2 mb-8">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              {/* Question */}
              <div className="text-center mb-8">
                <p className="text-sm text-muted-foreground mb-2">
                  Question {currentStep + 1} of {questions.length}
                </p>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">
                  {questions[currentStep].question}
                </h1>
                <p className="text-muted-foreground">{questions[currentStep].description}</p>
              </div>

              {/* Answers */}
              <div className="grid gap-3 max-w-md mx-auto">
                {questions[currentStep].answers.map((answer) => (
                  <Button
                    key={answer.value}
                    variant={answers[questions[currentStep].id] === answer.value ? "default" : "outline"}
                    size="lg"
                    className="w-full text-left justify-start h-auto py-4 px-6"
                    onClick={() => handleAnswer(questions[currentStep].id, answer.value)}
                  >
                    {answer.label}
                  </Button>
                ))}
              </div>

              {/* Back button */}
              {currentStep > 0 && (
                <div className="text-center mt-6">
                  <Button variant="ghost" onClick={() => setCurrentStep((prev) => prev - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous question
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Results */}
              <div className="text-center mb-8">
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">
                  Your Top Racket Picks
                </h1>
                <p className="text-muted-foreground">
                  Based on your answers, here are the rackets we recommend.
                </p>
              </div>

              <div className="space-y-4">
                {results.map(({ racket }, index) => (
                  <Link key={racket.id} href={`/rackets/${getRacketSlug(racket)}`}>
                    <Card className="hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                            {racket.imageUrl ? (
                              <img
                                src={racket.imageUrl}
                                alt={`${racket.brand} ${racket.model}`}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted rounded-md" />
                            )}
                          </div>
                          {index === 0 && (
                            <Badge className="absolute -top-2 -left-2 text-xs">Best Match</Badge>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{racket.brand}</p>
                          <h3 className="font-semibold text-lg truncate">{racket.model}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs capitalize">{racket.shape}</Badge>
                            <span className="text-xs text-muted-foreground">Rating: {racket.overallRating}/100</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">
                            €{Number(racket.currentPrice).toFixed(2)}
                          </p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="text-center mt-8 space-x-4">
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retake Quiz
                </Button>
                <Link href="/rackets">
                  <Button variant="ghost">Browse All Rackets</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
