from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from .schemas import VehicleLookupResponse


class AutofactLookupError(Exception):
    pass


class AutofactNotFoundError(AutofactLookupError):
    pass


class AutofactBlockedError(AutofactLookupError):
    pass


@dataclass
class AutofactConfig:
    base_url: str
    default_email: str
    headless: bool
    timeout_ms: int
    debug_html: bool
    browser_ws_endpoint: str | None
    proxy_server: str | None
    proxy_username: str | None
    proxy_password: str | None


def load_config() -> AutofactConfig:
    return AutofactConfig(
        base_url=os.getenv("AUTOFACT_BASE_URL", "https://www.autofact.cl/buscar-patente"),
        default_email=os.getenv("AUTOFACT_DEFAULT_EMAIL", "").strip(),
        headless=os.getenv("AUTOFACT_HEADLESS", "true").lower() != "false",
        timeout_ms=int(os.getenv("AUTOFACT_TIMEOUT_MS", "30000")),
        debug_html=os.getenv("AUTOFACT_DEBUG_HTML", "false").lower() == "true",
        browser_ws_endpoint=os.getenv("PLAYWRIGHT_WS_ENDPOINT", "").strip() or None,
        proxy_server=os.getenv("AUTOFACT_PROXY_SERVER", "").strip() or None,
        proxy_username=os.getenv("AUTOFACT_PROXY_USERNAME", "").strip() or None,
        proxy_password=os.getenv("AUTOFACT_PROXY_PASSWORD", "").strip() or None,
    )


def normalize_patente(patente: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", patente.upper())


def title_case(value: str | None) -> str | None:
    if not value:
        return None
    value = re.sub(r"\s+", " ", value).strip()
    if not value:
        return None
    return " ".join(chunk.capitalize() for chunk in value.split(" "))


def extract_label_value_pairs(soup: BeautifulSoup) -> dict[str, str]:
    pairs: dict[str, str] = {}

    for row in soup.select("tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) >= 2:
            label = cells[0].get_text(" ", strip=True).rstrip(":").lower()
            value = cells[1].get_text(" ", strip=True)
            if label and value:
                pairs[label] = value

    for item in soup.select("li, p, div, span"):
        text = item.get_text(" ", strip=True)
        if ":" not in text:
            continue
        label, value = text.split(":", 1)
        label = label.strip().lower()
        value = value.strip()
        if label and value and len(label) < 80 and len(value) < 250:
            pairs.setdefault(label, value)

    for dt in soup.select("dt"):
        dd = dt.find_next("dd")
        if dd:
            label = dt.get_text(" ", strip=True).rstrip(":").lower()
            value = dd.get_text(" ", strip=True)
            if label and value:
                pairs[label] = value

    return pairs


def value_from_pairs(pairs: dict[str, str], aliases: list[str]) -> str | None:
    lowered = {key.lower(): value for key, value in pairs.items()}
    for alias in aliases:
        alias_lower = alias.lower()
        if alias_lower in lowered:
            return lowered[alias_lower]

    for key, value in lowered.items():
        for alias in aliases:
            alias_lower = alias.lower()
            if alias_lower in key:
                return value
    return None


def extract_vehicle_data(html: str, patente: str) -> VehicleLookupResponse | None:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    lowered = text.lower()

    if any(token in lowered for token in [
        "captcha",
        "cloudflare",
        "access denied",
        "attention required",
        "demasiadas solicitudes",
    ]):
        raise AutofactBlockedError("Autofact devolvió una página de protección anti-bot.")

    if any(token in lowered for token in [
        "no se encontraron resultados",
        "patente no encontrada",
        "sin resultados",
    ]):
        raise AutofactNotFoundError("Autofact no encontró información para esa patente.")

    pairs = extract_label_value_pairs(soup)
    marca = title_case(value_from_pairs(pairs, ["marca", "fabricante"]))
    modelo = title_case(value_from_pairs(pairs, ["modelo", "versión", "version"]))
    motor = value_from_pairs(pairs, ["motor", "cilindrada"])
    combustible = title_case(value_from_pairs(pairs, ["combustible", "tipo de combustible"]))
    transmision = title_case(value_from_pairs(pairs, ["transmisión", "transmision", "caja"]))

    year_text = value_from_pairs(pairs, ["año", "año de fabricación", "fabricación", "ano"])
    year_match = re.search(r"\b(19|20)\d{2}\b", year_text or text)
    año = int(year_match.group(0)) if year_match else None

    if not marca or not modelo:
        title_match = re.search(rf"{patente}\s+([A-Za-z0-9\- ]+?)\s+\b(19|20)\d{{2}}\b", text, re.IGNORECASE)
        if title_match:
            title_bits = re.sub(r"\s+", " ", title_match.group(1)).strip().split(" ")
            if title_bits:
                marca = marca or title_case(title_bits[0])
                modelo = modelo or title_case(" ".join(title_bits[1:]))

    if not marca or not modelo or not año:
        return None

    return VehicleLookupResponse(
        patente=patente,
        marca=marca,
        modelo=modelo,
        año=año,
        motor=motor,
        combustible=combustible,
        transmision=transmision,
        fuente="autofact",
        raw_text_preview=text[:400],
    )


async def first_locator(page: Page, selectors: list[str]):
    for selector in selectors:
        locator = page.locator(selector).first
        try:
            if await locator.count() > 0:
                return locator
        except Exception:
            continue
    return None


async def fill_form(page: Page, patente: str, email: str, timeout_ms: int) -> None:
    plate_locator = await first_locator(page, [
        "input[name*='patente' i]",
        "input[id*='patente' i]",
        "input[placeholder*='patente' i]",
        "input[type='text']",
    ])
    if plate_locator is None:
        raise AutofactLookupError("No se encontró el input de patente en Autofact.")

    await plate_locator.click()
    await plate_locator.fill("")
    await plate_locator.fill(patente)

    email_locator = await first_locator(page, [
        "input[name='email']",
        "input[type='email']",
        "input[placeholder*='correo' i]",
        "input[placeholder*='email' i]",
    ])
    if email_locator is None:
        raise AutofactLookupError("No se encontró el input de email en Autofact.")

    await email_locator.click()
    await email_locator.fill("")
    await email_locator.fill(email)

    accept_checkbox = page.locator("input[type='checkbox']").first
    try:
        if await accept_checkbox.count() > 0 and not await accept_checkbox.is_checked():
            await accept_checkbox.check()
    except Exception:
        pass

    search_button = page.get_by_role("button", name=re.compile(r"buscar patente|buscar", re.I)).first
    if await search_button.count() == 0:
        search_button = page.locator("button, input[type='submit']").filter(has_text=re.compile("buscar", re.I)).first

    if await search_button.count() == 0:
        raise AutofactLookupError("No se encontró el botón de búsqueda en Autofact.")

    await search_button.click()
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except Exception:
        await page.wait_for_timeout(2500)


async def lookup_vehicle(patente: str, email: str | None = None) -> VehicleLookupResponse:
    config = load_config()
    normalized_patente = normalize_patente(patente)
    lookup_email = (email or config.default_email).strip()

    if not lookup_email:
        raise AutofactLookupError("AUTOFACT_DEFAULT_EMAIL no está configurado.")

    async with async_playwright() as playwright:
        if config.browser_ws_endpoint:
            browser = await playwright.chromium.connect(config.browser_ws_endpoint)
        else:
            proxy = None
            if config.proxy_server:
                proxy = {
                    "server": config.proxy_server,
                }
                if config.proxy_username:
                    proxy["username"] = config.proxy_username
                if config.proxy_password:
                    proxy["password"] = config.proxy_password

            browser = await playwright.chromium.launch(
                headless=config.headless,
                proxy=proxy,
            )
        context: BrowserContext = await browser.new_context(
            locale="es-CL",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )
        page: Page = await context.new_page()

        try:
            await page.goto(config.base_url, wait_until="domcontentloaded", timeout=config.timeout_ms)

            cookie_button = page.get_by_role("button", name=re.compile(r"aceptar|entendido|continuar", re.I)).first
            try:
                if await cookie_button.count() > 0:
                    await cookie_button.click(timeout=1500)
            except Exception:
                pass

            await fill_form(page, normalized_patente, lookup_email, config.timeout_ms)

            for _ in range(5):
                html = await page.content()
                result = extract_vehicle_data(html, normalized_patente)
                if result:
                    return result
                await page.wait_for_timeout(1500)

            if config.debug_html:
                debug_path = Path(__file__).resolve().parents[1] / "debug_last_response.html"
                debug_path.write_text(await page.content(), encoding="utf-8")

            raise AutofactLookupError(
                "Autofact respondió, pero no fue posible extraer marca/modelo/año con los selectores actuales."
            )
        finally:
            await context.close()
            await browser.close()
