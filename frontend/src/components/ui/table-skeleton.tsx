import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface TableSkeletonProps {
    columnCount?: number
    rowCount?: number
    showHeaders?: boolean
}

export function TableSkeleton({
    columnCount = 5,
    rowCount = 5,
    showHeaders = true,
}: TableSkeletonProps) {
    return (
        <Table>
            {showHeaders && (
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: columnCount }).map((_, i) => (
                            <TableHead key={i}>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
            )}
            <TableBody>
                {Array.from({ length: rowCount }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: columnCount }).map((_, j) => (
                            <TableCell key={j}>
                                <Skeleton className="h-4 w-full" />
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
