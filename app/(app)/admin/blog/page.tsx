import type { Metadata } from "next"

import { PostManager } from "@/features/blog/components/post-manager"

export const metadata: Metadata = {
  title: "Blog",
  description: "Publish, schedule or take down the posts written in the Studio.",
}

export default function AdminBlogPage() {
  return <PostManager />
}
