import { useMemo } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";
import { LOCALE_ENDONYMS, type Locale } from "@/i18n/I18nProvider";

interface LanguageSwitcherProps {
  variant?: "button" | "select";
  align?: "start" | "end";
  className?: string;
}

export function LanguageSwitcher({
  variant = "button",
  align = "end",
  className,
}: LanguageSwitcherProps) {
  const { locale, availableLocales, setLocale, t } = useI18n();

  const options = useMemo(
    () =>
      availableLocales.map((code) => ({
        code,
        label: LOCALE_ENDONYMS[code] ?? code.toUpperCase(),
      })),
    [availableLocales],
  );

  if (options.length <= 1) {
    return null;
  }

  const label = t("common.language.label");

  if (variant === "select") {
    return (
      <div className={cn("space-y-1", className)}>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                <div className="flex w-full items-center justify-between">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.code.toUpperCase()}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Languages className="h-4 w-4" aria-hidden />
          <span className="hidden lg:inline">{label}</span>
          <span className="font-semibold">{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onSelect={() => setLocale(option.code as Locale)}
            className={cn(
              "flex items-center justify-between gap-2",
              option.code === locale && "font-semibold",
            )}
          >
            <span>{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {option.code.toUpperCase()}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


