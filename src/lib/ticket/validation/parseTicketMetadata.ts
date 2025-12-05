/**
 * Parse and extract ticket metadata with type safety
 */

import type { TicketMetadata } from "@/types/ticket";

export function parseTicketMetadata(
  metadata: unknown
): TicketMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as TicketMetadata;
}

export function extractTATFromMetadata(metadata: TicketMetadata) {
  return {
    tat: metadata.tat ? (typeof metadata.tat === 'string' ? metadata.tat : null) : null,
    tatDate: metadata.tatDate ? (typeof metadata.tatDate === 'string' ? metadata.tatDate : null) : null,
    tatSetAt: metadata.tatSetAt 
      ? (typeof metadata.tatSetAt === 'string' 
          ? metadata.tatSetAt 
          : (metadata.tatSetAt && typeof metadata.tatSetAt === 'object' && 'toISOString' in metadata.tatSetAt && typeof (metadata.tatSetAt as { toISOString: () => string }).toISOString === 'function')
            ? (metadata.tatSetAt as { toISOString: () => string }).toISOString() 
            : null) 
      : null,
    tatSetBy: metadata.tatSetBy ? (typeof metadata.tatSetBy === 'string' ? metadata.tatSetBy : null) : null,
    tatExtensions: Array.isArray(metadata.tatExtensions) 
      ? metadata.tatExtensions as Array<Record<string, unknown>> 
      : [],
  };
}

export function extractImagesFromMetadata(metadata: TicketMetadata): string[] {
  if (metadata.images && Array.isArray(metadata.images)) {
    return metadata.images.filter((img): img is string => typeof img === 'string');
  }
  return [];
}
