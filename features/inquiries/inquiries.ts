/** Client-safe inquiry constants (§4). */

/**
 * The topic the home page's "Notify me" used to post to the contact endpoint
 * under. Sign-ups have their own endpoint now (features/newsletter); this
 * stays so a page loaded before that change still reaches the list.
 */
export const DROP_LIST_TOPIC = "Drop list"
