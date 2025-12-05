"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Batch {
	batch_year: number;
}

interface Hostel {
	id: number;
	name: string;
}

interface StudentsFiltersProps {
	search: string;
	hostelFilter: string;
	batchYearFilter: string;
	onSearchChange: (value: string) => void;
	onHostelFilterChange: (value: string) => void;
	onBatchYearFilterChange: (value: string) => void;
	onSearch: () => void;
	onKeyPress: (e: React.KeyboardEvent) => void;
	batches: Batch[];
	hostels: Hostel[];
}

export function StudentsFilters({
	search,
	hostelFilter,
	batchYearFilter,
	onSearchChange,
	onHostelFilterChange,
	onBatchYearFilterChange,
	onSearch,
	onKeyPress,
	batches,
	hostels,
}: StudentsFiltersProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Search & Filter</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="md:col-span-2">
						<div className="flex gap-2">
							<Input
								placeholder="Search by name or email..."
								value={search}
								onChange={(e) => onSearchChange(e.target.value)}
								onKeyPress={onKeyPress}
							/>
							<Button onClick={onSearch}>
								<Search className="w-4 h-4" />
							</Button>
						</div>
					</div>
					<Select value={hostelFilter} onValueChange={onHostelFilterChange}>
						<SelectTrigger>
							<SelectValue placeholder="Filter by hostel" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Hostels</SelectItem>
							{hostels.map((hostel) => (
								<SelectItem key={hostel.id} value={hostel.name}>
									{hostel.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={batchYearFilter} onValueChange={onBatchYearFilterChange}>
						<SelectTrigger>
							<SelectValue placeholder="Filter by batch" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Batches</SelectItem>
							{batches.map((batch) => (
								<SelectItem key={batch.batch_year} value={batch.batch_year.toString()}>
									Batch {batch.batch_year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	);
}
