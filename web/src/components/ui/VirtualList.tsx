"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

type Props<T> = {
  items: T[];
  estimateSize?: number;
  className?: string;
  maxHeight?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
};

export default function VirtualList<T>({
  items,
  estimateSize = 64,
  className = "",
  maxHeight = 420,
  renderItem,
  getKey,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
  });

  if (items.length <= 24) {
    return (
      <ul className={className}>
        {items.map((item, i) => (
          <li key={getKey(item, i)}>{renderItem(item, i)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className}`} style={{ maxHeight }}>
      <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          return (
            <li
              key={getKey(item, row.index)}
              className="absolute top-0 left-0 w-full"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              {renderItem(item, row.index)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
