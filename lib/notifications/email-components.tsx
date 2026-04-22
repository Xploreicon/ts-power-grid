/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
} from "@react-email/components";

interface BaseEmailProps {
  title: string;
  children: React.ReactNode;
}

export function BaseEmail({ title, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#F9FAFB", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "40px 20px", maxWidth: "600px" }}>
          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <Heading style={{ color: "#0F172A", fontSize: "24px", margin: "0 0 16px 0" }}>
              {title}
            </Heading>
            {children}
          </Section>
          <Text style={{ color: "#64748B", fontSize: "12px", textAlign: "center", marginTop: "24px" }}>
            T&S Power Grid Limited, Lagos, Nigeria
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function DefaultEmail({ title, body }: { title: string; body: string }) {
  return (
    <BaseEmail title={title}>
      <Text style={{ color: "#334155", fontSize: "16px", lineHeight: "24px" }}>
        {body}
      </Text>
    </BaseEmail>
  );
}
