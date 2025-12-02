import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MapPin, ImageIcon, Info } from "lucide-react";
import { ImageLightbox } from "@/components/tickets/ImageLightbox";
import { DynamicFieldDisplay } from "@/components/tickets/DynamicFieldDisplay";

interface DynamicField {
  key: string;
  label: string;
  value: string | string[];
  type: string;
}

interface TicketSubmittedInfoProps {
  description: string | null;
  location: string | null;
  images: string[];
  dynamicFields: DynamicField[];
}

export function TicketSubmittedInfo({
  description,
  location,
  images,
  dynamicFields,
}: TicketSubmittedInfoProps) {
  // Filter out TAT-related fields
  const filteredFields = dynamicFields.filter((field) => {
    const keyLower = field.key.toLowerCase();
    const labelLower = field.label.toLowerCase();
    return !keyLower.includes('tat') && 
           !labelLower.includes('tat') &&
           !keyLower.includes('tat_set') &&
           !labelLower.includes('tat set') &&
           !keyLower.includes('tat_extensions') &&
           !labelLower.includes('tat extensions');
  });

  return (
    <Card className="border-2 shadow-md">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent">
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          Submitted Information
        </CardTitle>
        <CardDescription>
          Details you provided when creating this ticket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {description && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border-2">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
            </div>
            <p className="text-base whitespace-pre-wrap leading-relaxed break-words font-medium">{description}</p>
          </div>
        )}

        {location && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</p>
            </div>
            <p className="text-sm font-semibold break-words">{location}</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments ({images.length})</p>
            </div>
            <ImageLightbox images={images} />
          </div>
        )}

        {filteredFields.length > 0 && (
          <div className="space-y-3">
            {filteredFields.map((field) => (
              <DynamicFieldDisplay key={field.key} field={{ ...field, fieldType: field.type }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
