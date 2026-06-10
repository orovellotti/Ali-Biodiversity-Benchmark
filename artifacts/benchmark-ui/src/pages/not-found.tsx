import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { tr } = useI18n();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {tr("404 Page introuvable", "404 Page Not Found")}
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {tr(
              "La page demandée n'existe pas ou a été déplacée.",
              "The page you are looking for doesn't exist or has been moved.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
