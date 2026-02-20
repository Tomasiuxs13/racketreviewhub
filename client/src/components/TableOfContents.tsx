import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocItem {
    id: string;
    text: string;
}

export function TableOfContents({ contentHtml, className }: { contentHtml: string; className?: string }) {
    const [items, setItems] = useState<TocItem[]>([]);
    const [activeId, setActiveId] = useState<string>("");

    useEffect(() => {
        // Extract h2 elements and assign IDs to the actual DOM elements if they don't have them
        const extractHeadings = () => {
            // Find the review content container
            const reviewContainer = document.querySelector('[data-testid="text-review-content"]');
            if (!reviewContainer) return;

            const headings = Array.from(reviewContainer.querySelectorAll('h2'));

            const newItems = headings.map((heading, index) => {
                // Generate a slug-like ID if not present
                const text = heading.textContent || "";
                const id = heading.id || `toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;

                // Mutate the actual DOM to add the ID for anchor linking
                if (!heading.id) {
                    heading.id = id;
                }

                // Add some scroll margin so the fixed header doesn't cover the title when clicking the jump link
                heading.style.scrollMarginTop = "100px";

                return { id, text };
            });

            setItems(newItems);
        };

        extractHeadings();

        // We wait a tiny bit to ensure the dangerouslySetInnerHTML has rendered
        const timeoutId = setTimeout(extractHeadings, 100);

        return () => clearTimeout(timeoutId);
    }, [contentHtml]);

    useEffect(() => {
        // Intersection Observer to highlight active section
        if (items.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: "0px 0px -80% 0px" } // Trigger when the heading is near the top
        );

        items.forEach((item) => {
            const element = document.getElementById(item.id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [items]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div className={cn("bg-card/50 rounded-xl border border-border/40 p-5 w-full", className)}>
            <h3 className="font-heading font-bold text-lg mb-3">Table of Contents</h3>
            <ul className="space-y-2 text-sm">
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            className={cn(
                                "block py-1 hover:text-primary transition-colors",
                                activeId === item.id ? "text-primary font-semibold" : "text-muted-foreground"
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                                setActiveId(item.id);
                            }}
                        >
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
