import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle } from "lucide-react";

interface NewsletterSignupProps {
  source: "homepage" | "review_page" | "footer";
  compact?: boolean;
}

export function NewsletterSignup({ source, compact = false }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Successfully subscribed!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 ${compact ? "text-sm" : "text-base"} text-green-600`}>
        <CheckCircle className="h-5 w-5 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="max-w-[220px]"
          disabled={status === "loading"}
        />
        <Button type="submit" size="sm" disabled={status === "loading"}>
          <Mail className="h-4 w-4 mr-1" />
          {status === "loading" ? "..." : "Subscribe"}
        </Button>
        {status === "error" && <span className="text-xs text-destructive self-center">{message}</span>}
      </form>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Get Price Drop Alerts</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Subscribe to get notified when racket prices drop and new reviews are published.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
          disabled={status === "loading"}
        />
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Subscribing..." : "Subscribe"}
        </Button>
      </form>
      {status === "error" && <p className="text-sm text-destructive">{message}</p>}
      <p className="text-xs text-muted-foreground">No spam. Unsubscribe anytime.</p>
    </div>
  );
}
