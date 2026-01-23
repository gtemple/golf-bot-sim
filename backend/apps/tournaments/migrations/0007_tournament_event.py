from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0006_tournamententry_avatar_color_tournamententry_country_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TournamentEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('round_number', models.PositiveSmallIntegerField()),
                ('text', models.CharField(max_length=255)),
                ('importance', models.SmallIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tournament', models.ForeignKey(on_delete=models.CASCADE, related_name='events', to='tournaments.tournament')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
