/**
   * Receive a string and it returns a slug
   *
   * Example "An example text" => "an-example-slug"
   *
   * @param text {string}
   * @returns {string}
   */
export function slugify(text: string) {
    return text
      .normalize('NFKD')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/_/g, '-')
      .replace(/--+/g, '-')
      .replace(/-$/g, '')
}