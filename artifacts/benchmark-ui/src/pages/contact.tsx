import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSubmitContact } from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Indiquez votre nom").max(120),
  email: z.string().trim().email("Adresse e-mail invalide").max(200),
  message: z
    .string()
    .trim()
    .min(1, "Écrivez votre message")
    .max(5000, "Message trop long (5000 caractères max)"),
});

type ContactForm = z.infer<typeof contactSchema>;

export function Contact() {
  const [sent, setSent] = useState(false);
  const submit = useSubmitContact();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const onSubmit = (data: ContactForm) => {
    submit.mutate(
      { data },
      {
        onSuccess: () => {
          setSent(true);
          reset();
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1200px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/questions">
            <BookOpen className="w-4 h-4 mr-2" /> Questions
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground font-mono mb-3">
          <MessageSquare className="w-4 h-4 text-primary" /> Contact
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          Écrire à Natural Solutions
        </h1>
        <p className="text-muted-foreground mt-3">
          Une question, une remarque sur le benchmark ou une idée de
          collaboration ? Laissez-nous un message, nous reviendrons vers vous.
        </p>

        {sent ? (
          <Card className="mt-8">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Message envoyé
              </h2>
              <p className="text-muted-foreground mt-2">
                Merci ! Votre message a bien été transmis à Natural Solutions.
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <Button variant="outline" onClick={() => setSent(false)}>
                  Envoyer un autre message
                </Button>
                <Button asChild>
                  <Link href="/console">Retour à la console</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium">
                    Nom
                  </label>
                  <Input
                    id="name"
                    placeholder="Votre nom"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Adresse e-mail
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.org"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    rows={6}
                    placeholder="Votre message..."
                    {...register("message")}
                  />
                  {errors.message && (
                    <p className="text-xs text-red-500">
                      {errors.message.message}
                    </p>
                  )}
                </div>

                {submit.isError && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    Une erreur est survenue lors de l'envoi. Réessayez.
                  </div>
                )}

                <Button type="submit" disabled={submit.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  {submit.isPending ? "Envoi..." : "Envoyer le message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
