import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class AssignConversationDto {
  // Pass null to unassign.
  @ValidateIf((o) => o.userId !== null)
  @IsString()
  @IsOptional()
  userId!: string | null;
}
