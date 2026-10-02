/**
 * REGRA (01/10/2026): a extensão do arquivo salvo no Storage precisa bater com
 * o MIME. O `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
 * contém "document" e era testado ANTES da regra de planilha → o `.xlsx` virava
 * `.docx` (apareceu na auto-cura do download de planilhas do chat).
 */
import { describe, it, expect } from "vitest";
import { getExtensionFromMime } from "./media-storage";

describe("getExtensionFromMime — documentos do chat", () => {
  it("planilhas ganham extensão de planilha", () => {
    expect(getExtensionFromMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
    expect(getExtensionFromMime("application/vnd.ms-excel")).toBe("xls");
    expect(getExtensionFromMime("application/vnd.oasis.opendocument.spreadsheet")).toBe("ods");
    expect(getExtensionFromMime("text/csv")).toBe("csv");
  });

  it("documentos de texto/apresentação/comprimidos", () => {
    expect(getExtensionFromMime("application/msword")).toBe("doc");
    expect(getExtensionFromMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(getExtensionFromMime("application/vnd.ms-powerpoint")).toBe("ppt");
    expect(getExtensionFromMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("pptx");
    expect(getExtensionFromMime("text/plain")).toBe("txt");
    expect(getExtensionFromMime("application/zip")).toBe("zip");
    expect(getExtensionFromMime("application/pdf")).toBe("pdf");
  });

  it("mídias seguem como antes (regressão)", () => {
    expect(getExtensionFromMime("image/jpeg")).toBe("jpg");
    expect(getExtensionFromMime("audio/ogg; codecs=opus")).toBe("ogg");
    expect(getExtensionFromMime("video/mp4")).toBe("mp4");
  });

  it("mime desconhecido cai em bin", () => {
    expect(getExtensionFromMime("application/x-coisa-rara")).toBe("bin");
  });
});
