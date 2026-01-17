import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple accordion implementation without external dependencies
type AccordionProps = {
  children: React.ReactNode;
  className?: string;
};

export function Accordion({ children, className }: AccordionProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

type AccordionItemProps = {
  children: React.ReactNode;
  className?: string;
};

export function AccordionItem({ children, className }: AccordionItemProps) {
  return <div className={cn('border-b last:border-b-0', className)}>{children}</div>;
}

type AccordionButtonProps = {
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
};

export function AccordionButton({ 
  children, 
  className, 
  showArrow = true 
}: AccordionButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <button
      className={cn(
        'flex flex-1 items-start justify-between gap-4 w-full rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
      {showArrow && (
        <ChevronDownIcon 
          className={cn(
            'text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      )}
    </button>
  );
}

type AccordionPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function AccordionPanel({ children, className }: AccordionPanelProps) {
  return (
    <div className={cn('text-sm pt-0 pb-4', className)}>
      {children}
    </div>
  );
}




