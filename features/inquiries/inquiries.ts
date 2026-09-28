/**
 * Client-safe inquiry constants (§4). Kept out of the schema file so the home
 * page's one-field form does not pull zod into its bundle for a string.
 */

/**
 * The topic a drop-list sign-up is filed under: the home page's "Notify me"
 * sends an email address and nothing else, and it lands in the inquiry inbox
 * staff already read, dated, which doubles as the record of consent.
 */
export const DROP_LIST_TOPIC = "Drop list"
