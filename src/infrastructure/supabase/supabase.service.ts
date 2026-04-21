import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  async getUser(accessToken: string): Promise<User> {
    const { client } = this.getClient();
    const result = await client.auth.getUser(accessToken);

    if (result.error || !result.data.user) {
      throw new UnauthorizedException(
        result.error?.message ?? "Invalid access token.",
      );
    }

    return result.data.user;
  }

  private getClient(): { client: SupabaseClient } {
    if (!this.client) {
      const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
      const anonKey = this.configService.get<string>("SUPABASE_ANON_KEY");

      if (!supabaseUrl || !anonKey) {
        throw new InternalServerErrorException(
          "Supabase environment variables are required.",
        );
      }

      this.client = createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    }

    return { client: this.client };
  }
}
