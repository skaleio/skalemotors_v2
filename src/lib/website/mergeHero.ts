import type { HeroProps } from "./sections";

export interface HeroSiteFields {
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
}

/** Mezcla props del bloque Hero con columnas legacy del sitio. */
export function mergeHeroProps(props: HeroProps, site: HeroSiteFields): HeroProps {
  return {
    title: props.title || site.hero_title || props.title,
    subtitle: props.subtitle || site.hero_subtitle || props.subtitle,
    imageUrl: props.imageUrl || site.hero_image_url || "",
    buttonText: props.buttonText || "Ver vehículos",
  };
}
