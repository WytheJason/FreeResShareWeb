'use client';

import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';

interface PaginationLinkProps {
  /** 当前页 */
  page: number;
  /** 总页数 */
  totalPages: number;
  /** 当前 URL 的查询字符串（来自服务端 searchParams 重建） */
  currentSearch?: string;
  /** 跳转基础路径，默认 '/' */
  basePath?: string;
}

/**
 * URL 驱动的分页包装组件
 * 点击页码时把新 page 写入 URL，由服务端组件重新查询
 */
export default function PaginationLink({
  page,
  totalPages,
  currentSearch = '',
  basePath = '/',
}: PaginationLinkProps) {
  const router = useRouter();

  function handleChange(newPage: number) {
    const params = new URLSearchParams(currentSearch);
    params.set('page', String(newPage));
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <Pagination page={page} totalPages={totalPages} onChange={handleChange} />
  );
}
