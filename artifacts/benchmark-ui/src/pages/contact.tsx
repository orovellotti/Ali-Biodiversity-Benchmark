import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSubmitContact } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
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

type ContactForm = {
  name: string;
  email: string;
  message: string;
};

export function Contact() {
  const { tr } = useI18n();
  const [sent, setSent] = useState(false);
  const submit = useSubmitContact();

  const contactSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, tr("Indiquez votre nom", "Enter your name"))
          .max(120),
        email: z
          .string()
          .trim()
          .email(tr("Adresse e-mail invalide", "Invalid email address"))
          .max(200),
        message: z
          .string()
          .trim()
          .min(1, tr("Écrivez votre message", "Write your message"))
          .max(
            5000,
            tr(
              "Message trop long (5000 caractères max)",
              "Message too long (5000 characters max)",
            ),
          ),
      }),
    [tr],
  );

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
          {tr("Écrire à Natural Solutions", "Write to Natural Solutions")}
        </h1>
        <p className="text-muted-foreground mt-3">
          {tr(
            "Une question, une remarque sur le benchmark ou une idée de collaboration ? Laissez-nous un message, nous reviendrons vers vous.",
            "A question, a remark about the benchmark, or a collaboration idea? Leave us a message and we'll get back to you.",
          )}
        </p>

        {sent ? (
          <Card className="mt-8">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {tr("Message envoyé", "Message sent")}
              </h2>
              <p className="text-muted-foreground mt-2">
                {tr(
                  "Merci ! Votre message a bien été transmis à Natural Solutions.",
                  "Thank you! Your message has been sent to Natural Solutions.",
                )}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <Button variant="outline" onClick={() => setSent(false)}>
                  {tr("Envoyer un autre message", "Send another message")}
                </Button>
                <Button asChild>
                  <Link href="/console">
                    {tr("Retour à la console", "Back to console")}
                  </Link>
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
                    {tr("Nom", "Name")}
                  </label>
                  <Input
                    id="name"
                    placeholder={tr("Votre nom", "Your name")}
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    {tr("Adresse e-mail", "Email address")}
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
                    {tr("Message", "Message")}
                  </label>
                  <Textarea
                    id="message"
                    rows={6}
                    placeholder={tr("Votre message...", "Your message...")}
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
                    {tr(
                      "Une erreur est survenue lors de l'envoi. Réessayez.",
                      "An error occurred while sending. Please try again.",
                    )}
                  </div>
                )}

                <Button type="submit" disabled={submit.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  {submit.isPending
                    ? tr("Envoi...", "Sending...")
                    : tr("Envoyer le message", "Send message")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
