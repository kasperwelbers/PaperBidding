'use client';

import * as React from 'react';
import { FaCheck, FaChevronDown } from 'react-icons/fa';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function Combobox({
  items,
  label,
  onSelect
}: {
  items: any[];
  label: string;
  onSelect?: (item: any) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between text-left "
        >
          <div className="whitespace-nowrap overflow-hidden overflow-ellipsis">
            {value || `Select ${label}...`}
          </div>
          {value ? (
            <FaCheck className="ml-2 h-4 w-4 shrink-0 opacity-50 text-green-700" />
          ) : (
            <FaChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 ">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} />
          <CommandEmpty>No {label} found.</CommandEmpty>
          <CommandGroup className="max-h-48 overflow-auto">
            {items.map((item, index) => {
              if (typeof item === 'string') item = { id: index, name: item };

              // the smdk library that shadcdn forces the value to be lowercase
              // Not a big risk in this app, but definitely not great either
              item.STUPIDLOWERCASE = item.name.toLowerCase();

              return (
                <CommandItem
                  key={item.id}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    onSelect?.(item);
                  }}
                >
                  <FaCheck
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.STUPIDLOWERCASE ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {item.name}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
